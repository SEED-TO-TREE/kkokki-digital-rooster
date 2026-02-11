import requests
import os
import json
import time
import google.generativeai as genai
from datetime import datetime, timedelta
from dotenv import load_dotenv

# .env 파일에서 SK_API_KEY와 GOOGLE_API_KEY를 로드합니다.
load_dotenv()

class KkokkiEngine:
    def __init__(self):
        self.sk_api_key = os.getenv("SK_API_KEY")
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.base_url = "https://apis.openapi.sk.com/tmap"
        
        # 기본 설정값 (해커톤 MVP용 고정 설정)
        self.default_prep_time = 30  # 사용자 준비 시간 (30분)
        self.buffer_time = 10        # 여유 시간 (10분)
        
        # Gemini AI 설정
        if self.google_api_key:
            genai.configure(api_key=self.google_api_key)
            # 시스템 지원 모델인 gemini-2.5-flash-preview-09-2025 사용
            self.model = genai.GenerativeModel('gemini-2.5-flash-preview-09-2025')
        else:
            print("⚠️ 경고: GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")

    def get_coordinates(self, keyword):
        """장소 명칭을 위경도 좌표로 변환 (POI 검색)"""
        url = f"{self.base_url}/pois"
        headers = {"appKey": self.sk_api_key, "Accept": "application/json"}
        params = {
            "version": 1,
            "format": "json",
            "searchKeyword": keyword,
            "resCoordType": "WGS84GEO",
            "count": 1
        }
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            raise Exception(f"POI 검색 실패: {response.status_code}")
            
        data = response.json()
        pois = data.get("searchPoiInfo", {}).get("pois", {}).get("poi", [])
        if not pois:
            raise Exception(f"'{keyword}'를 찾을 수 없습니다.")
        
        poi = pois[0]
        return {"name": poi["name"], "lon": poi["frontLon"], "lat": poi["frontLat"]}

    def calculate_route(self, start, end):
        """실시간 소요 시간 계산 (자동차 경로)"""
        url = f"{self.base_url}/routes?version=1&format=json"
        headers = {"appKey": self.sk_api_key, "Content-Type": "application/json"}
        payload = {
            "startX": start["lon"], 
            "startY": start["lat"],
            "endX": end["lon"], 
            "endY": end["lat"],
            "reqCoordType": "WGS84GEO", 
            "resCoordType": "WGS84GEO",
            "searchOption": "0", # 최적경로 (실시간 교통정보 반영)
            "trafficInfo": "Y"
        }
        
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            raise Exception(f"경로 계산 실패: {response.status_code}")
            
        props = response.json()["features"][0]["properties"]
        return {
            "minutes": round(int(props["totalTime"]) / 60),
            "distance": round(int(props["totalDistance"]) / 1000, 1)
        }

    def generate_delay_message(self, start, end, target_time, delay_min):
        """지각 상황 시 Gemini를 사용하여 맞춤형 사과 메시지 생성"""
        prompt = f"""
        사용자가 현재 교통 정체로 인해 지각이 예상됩니다.
        상황: {start}에서 {end}로 이동 중이며, 목표 도착 시간은 {target_time}이지만 현재 상황으로는 약 {delay_min}분 지연될 것으로 보입니다.
        
        팀원들에게 보낼 상황별 메시지를 한국어로 작성해줘:
        1. 정중하고 공식적인 사과 메시지
        2. 친근한 팀원용 위트 있는 메시지
        """
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"현재 교통 체증으로 인해 약 {delay_min}분 정도 늦을 것 같습니다. 죄송합니다. (AI 생성 오류)"

    def run(self):
        print("\n" + "="*50)
        print("   Kkokki: Autonomous Morning Orchestrator")
        print("="*50 + "\n")
        
        try:
            # 테스트를 위해 입력값 고정 (사용자 요청 반영)
            start_name = "파크시엘아파트"
            end_name = "kt우면연구센터"
            arrival_input = "20:30"
            
            start_coord = self.get_coordinates(start_name)
            end_coord = self.get_coordinates(end_name)

            self.log(f"출발지: {start_coord['name']}")
            self.log(f"목적지: {end_coord['name']}")
            self.log(f"목표 도착 시간: {arrival_input}")
            print("-" * 50)
            self.log("실시간 모니터링 가동 (테스트 모드: 5초 간격 / 3회 반복)")
            
            counter = 0
            max_iterations = 3
            
            while counter < max_iterations:
                counter += 1
                self.log(f"모니터링 {counter}/{max_iterations} 회차 실행 중...")
                
                route = self.calculate_route(start_coord, end_coord)
                
                now = datetime.now()
                target = datetime.strptime(arrival_input, "%H:%M").replace(
                    year=now.year, month=now.month, day=now.day
                )
                # 시간이 이미 지났다면 내일 날짜로 계산
                if target < now: target += timedelta(days=1)

                # 기상 시간 계산 (도착 - 이동 - 준비 - 버퍼)
                leave_home = target - timedelta(minutes=route["minutes"] + self.buffer_time)
                wake_up = leave_home - timedelta(minutes=self.default_prep_time)

                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 분석 결과:")
                print(f" 🚗 실시간 이동 시간: {route['minutes']}분 ({route['distance']}km)")
                print(f" 🔔 권장 기상 시간: {wake_up.strftime('%H:%M')}")
                
                # 지각 여부 및 메시지 생성 로직
                if now > wake_up:
                    delay = (now - wake_up).seconds // 60
                    print(f" ⚠️  지각 위험! 현재 권장 기상 시간보다 {delay}분 늦었습니다.")
                    
                    if self.google_api_key:
                        self.log("AI가 상황에 맞는 알림 메시지를 작성합니다...")
                        msg = self.generate_delay_message(start_coord['name'], end_coord['name'], arrival_input, delay)
                        print(f"\n[꼬끼 AI 메시지 초안]\n{msg}")
                    break # 지각 상황이 감지되면 메시지 생성 후 중단
                else:
                    print(f" ✅ 현재 정상이네요. {wake_up.strftime('%H:%M')} 알람까지 대기 중입니다.")
                
                if counter < max_iterations:
                    print(f"--- 5초 후 재확인합니다 ---")
                    time.sleep(5)
            
            print("\n" + "="*50)
            self.log("테스트 루프가 완료되었습니다.")
                
        except KeyboardInterrupt:
            print("\n👋 모니터링을 강제 종료합니다.")
        except Exception as e:
            print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    engine = KkokkiEngine()
    engine.run()