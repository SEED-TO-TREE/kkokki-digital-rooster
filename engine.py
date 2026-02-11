import requests
import os
import json
import time
import threading
import urllib3
import google.generativeai as genai
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Disable SSL warnings for corporate proxy environments
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Load environment variables
load_dotenv()

class KkokkiEngine:
    def __init__(self):
        self.sk_api_key = os.getenv("SK_API_KEY")
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.slack_webhook_url = os.getenv("SLACK_WEBHOOK_URL")
        self.base_url = "https://apis.openapi.sk.com/tmap"
        
        # Configuration
        self.default_prep_time = 30  # minutes
        self.buffer_time = 10        # minutes
        
        # Internal State
        self.is_running = False
        self.logs = []
        self.status = "대기 중"
        self.latest_result = None
        self.monitor_thread = None
        
        # API Setup
        if self.google_api_key:
            genai.configure(api_key=self.google_api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash-preview-09-2025')
        else:
            self.log("⚠️ WARNING: GOOGLE_API_KEY is not set.")

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_message = f"[{timestamp}] {message}"
        print(formatted_message)
        self.logs.append(formatted_message)
        # Keep only last 50 logs
        if len(self.logs) > 50:
            self.logs.pop(0)

    def get_coordinates(self, keyword):
        """Convert location name to coordinates (POI)"""
        url = f"{self.base_url}/pois"
        headers = {"appKey": self.sk_api_key, "Accept": "application/json"}
        params = {
            "version": 1,
            "format": "json",
            "searchKeyword": keyword,
            "resCoordType": "WGS84GEO",
            "count": 1
        }
        response = requests.get(url, headers=headers, params=params, verify=False)
        
        if response.status_code != 200:
            raise Exception(f"POI Search Failed: {response.status_code}")
            
        data = response.json()
        pois = data.get("searchPoiInfo", {}).get("pois", {}).get("poi", [])
        if not pois:
            raise Exception(f"Cannot find location: '{keyword}'")
        
        poi = pois[0]
        return {"name": poi["name"], "lon": poi["frontLon"], "lat": poi["frontLat"]}

    def reverse_geocode(self, lat, lon):
        """Convert coordinates to address using TMAP reverse geocoding"""
        url = f"{self.base_url}/geo/reversegeocoding"
        headers = {"appKey": self.sk_api_key, "Accept": "application/json"}
        params = {
            "version": 1,
            "format": "json",
            "coordType": "WGS84GEO",
            "addressType": "A10",  # 도로명 주소
            "lon": lon,
            "lat": lat
        }
        
        try:
            response = requests.get(url, headers=headers, params=params, verify=False)
            if response.status_code != 200:
                self.log(f"Reverse geocode failed: {response.status_code}")
                return {"name": "선택한 위치", "address": f"{lat:.6f}, {lon:.6f}"}
            
            data = response.json()
            addr_info = data.get("addressInfo", {})
            
            # Build address string
            full_addr = addr_info.get("fullAddress", "")
            road_addr = addr_info.get("roadAddressKey", {})
            building_name = addr_info.get("buildingName", "")
            
            name = building_name if building_name else "선택한 위치"
            address = full_addr if full_addr else f"{lat:.6f}, {lon:.6f}"
            
            return {"name": name, "address": address}
            
        except Exception as e:
            self.log(f"Reverse geocode error: {e}")
            return {"name": "선택한 위치", "address": f"{lat:.6f}, {lon:.6f}"}

    def search_locations(self, keyword):
        """Search for locations and return a list of candidates (POI)"""
        url = f"{self.base_url}/pois"
        headers = {"appKey": self.sk_api_key, "Accept": "application/json"}
        params = {
            "version": 1,
            "format": "json",
            "searchKeyword": keyword,
            "resCoordType": "WGS84GEO",
            "reqCoordType": "WGS84GEO",
            "count": 10  # Return up to 10 results for autocomplete
        }
        
        try:
            # Disable SSL verification for corporate networks with proxy
            response = requests.get(url, headers=headers, params=params, verify=False)
            if response.status_code != 200:
                self.log(f"POI Search Failed: {response.status_code}")
                return []
                
            data = response.json()
            pois = data.get("searchPoiInfo", {}).get("pois", {}).get("poi", [])
            
            results = []
            for poi in pois:
                # Build full address
                addr_parts = [
                    poi.get("upperAddrName", ""),
                    poi.get("middleAddrName", ""),
                    poi.get("lowerAddrName", ""),
                    poi.get("detailAddrName", "")
                ]
                address = " ".join(part for part in addr_parts if part)
                
                results.append({
                    "name": poi["name"],
                    "lat": float(poi["noorLat"]),
                    "lon": float(poi["noorLon"]),
                    "address": address
                })
            return results
        except Exception as e:
            self.log(f"Error searching locations: {e}")
            return []

    def calculate_route(self, start, end, transport_mode='car'):
        """Calculate real-time route info based on transport mode
        
        Args:
            start: dict with 'lat', 'lon' keys
            end: dict with 'lat', 'lon' keys  
            transport_mode: 'car', 'transit', or 'walk'
        
        Returns:
            dict with 'minutes', 'distance', and mode-specific info
        """
        if transport_mode == 'transit':
            return self.calculate_transit_route(start, end)
        elif transport_mode == 'walk':
            return self.calculate_walk_route(start, end)
        else:
            return self.calculate_car_route(start, end)
    
    def calculate_car_route(self, start, end):
        """Calculate car driving route"""
        url = f"{self.base_url}/routes?version=1&format=json"
        headers = {"appKey": self.sk_api_key, "Content-Type": "application/json"}
        payload = {
            "startX": start["lon"], 
            "startY": start["lat"],
            "endX": end["lon"], 
            "endY": end["lat"],
            "reqCoordType": "WGS84GEO", 
            "resCoordType": "WGS84GEO",
            "searchOption": "0",  # Optimal path
            "trafficInfo": "Y"
        }
        
        response = requests.post(url, headers=headers, json=payload, verify=False)
        if response.status_code != 200:
            raise Exception(f"Car route calculation failed: {response.status_code}")
            
        props = response.json()["features"][0]["properties"]
        return {
            "mode": "car",
            "minutes": round(int(props["totalTime"]) / 60),
            "distance": round(int(props["totalDistance"]) / 1000, 1)
        }
    
    def calculate_walk_route(self, start, end):
        """Calculate pedestrian walking route
        
        API: https://apis.openapi.sk.com/tmap/routes/pedestrian
        """
        url = f"{self.base_url}/routes/pedestrian?version=1&format=json"
        headers = {"appKey": self.sk_api_key, "Content-Type": "application/json"}
        payload = {
            "startX": str(start["lon"]),
            "startY": str(start["lat"]),
            "endX": str(end["lon"]),
            "endY": str(end["lat"]),
            "reqCoordType": "WGS84GEO",
            "resCoordType": "WGS84GEO",
            "startName": start.get("name", "출발지"),
            "endName": end.get("name", "도착지")
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, verify=False)
            
            if response.status_code != 200:
                self.log(f"Walk API error: {response.status_code} - {response.text}")
                raise Exception(f"Walk route calculation failed: {response.status_code}")
            
            data = response.json()
            
            # Get total info from first feature properties
            if "features" not in data or len(data["features"]) == 0:
                raise Exception("Invalid walk API response format")
            
            props = data["features"][0]["properties"]
            total_time = props.get("totalTime", 0)  # in seconds
            total_distance = props.get("totalDistance", 0)  # in meters
            
            return {
                "mode": "walk",
                "minutes": round(total_time / 60),
                "distance": round(total_distance / 1000, 1)
            }
            
        except Exception as e:
            self.log(f"Walk route error: {e}")
            raise
    
    def calculate_transit_route(self, start, end):
        """Calculate public transit route (subway, bus)
        
        API: https://apis.openapi.sk.com/transit/routes/sub/
        pathType: 1=지하철, 2=버스, 3=버스+지하철
        """
        url = "https://apis.openapi.sk.com/transit/routes/sub/"
        headers = {
            "appKey": self.sk_api_key, 
            "accept": "application/json",
            "content-type": "application/json"
        }
        
        # Get current datetime for searchDttm (format: YYYYMMDDHHmm)
        now = datetime.now()
        search_dttm = now.strftime("%Y%m%d%H%M")
        
        payload = {
            "startX": str(start["lon"]),
            "startY": str(start["lat"]),
            "endX": str(end["lon"]),
            "endY": str(end["lat"]),
            "format": "json",
            "count": 10,
            "searchDttm": search_dttm
        }
        
        try:
            # Debug: Log the actual request
            self.log(f"Transit API Request - URL: {url}")
            self.log(f"Transit API Request - Headers: {headers}")
            self.log(f"Transit API Request - Payload: {payload}")
            
            response = requests.post(url, headers=headers, json=payload, verify=False)
            
            self.log(f"Transit API Response - Status: {response.status_code}")
            
            if response.status_code != 200:
                self.log(f"Transit API error: {response.status_code} - {response.text}")
                raise Exception(f"Transit route calculation failed: {response.status_code}")
            
            data = response.json()
            
            # Get routes from response
            if "metaData" not in data or "plan" not in data["metaData"]:
                raise Exception("Invalid transit API response format")
            
            itineraries = data["metaData"]["plan"].get("itineraries", [])
            if not itineraries:
                raise Exception("No transit routes found")
            
            # Sort by totalTime and get the fastest route
            itineraries_sorted = sorted(itineraries, key=lambda x: x.get("totalTime", 999999))
            best_route = itineraries_sorted[0]
            
            total_time = best_route.get("totalTime", 0)  # in seconds
            total_distance = best_route.get("totalDistance", 0)  # in meters
            total_walk_time = best_route.get("totalWalkTime", 0)  # in seconds
            total_walk_distance = best_route.get("totalWalkDistance", 0)  # in meters
            transfer_count = best_route.get("transferCount", 0)
            path_type = best_route.get("pathType", 0)  # 1=지하철, 2=버스, 3=버스+지하철
            total_fare = best_route.get("fare", {}).get("regular", {}).get("totalFare", 0)
            
            # pathType to description
            path_type_names = {1: "지하철", 2: "버스", 3: "버스+지하철"}
            path_type_name = path_type_names.get(path_type, "대중교통")
            
            # Build all route options for display
            route_options = []
            for idx, route in enumerate(itineraries_sorted[:5]):  # Top 5 routes
                pt = route.get("pathType", 0)
                route_options.append({
                    "index": idx + 1,
                    "minutes": round(route.get("totalTime", 0) / 60),
                    "transfers": route.get("transferCount", 0),
                    "fare": route.get("fare", {}).get("regular", {}).get("totalFare", 0),
                    "type": path_type_names.get(pt, "대중교통"),
                    "walk_minutes": round(route.get("totalWalkTime", 0) / 60)
                })
            
            return {
                "mode": "transit",
                "minutes": round(total_time / 60),
                "distance": round(total_distance / 1000, 1),
                "fare": total_fare,
                "transfers": transfer_count,
                "walk_minutes": round(total_walk_time / 60),
                "walk_distance": total_walk_distance,
                "path_type": path_type_name,
                "route_options": route_options,
                "route_count": len(itineraries)
            }
            
        except Exception as e:
            self.log(f"Transit route error: {e}")
            raise

    def generate_delay_message(self, start, end, target_time, delay_min):
        """Generate excuse message using Gemini"""
        prompt = f"""
        사용자가 현재 교통 정체로 인해 지각이 예상됩니다.
        상황: {start}에서 {end}로 이동 중이며, 목표 도착 시간은 {target_time}이지만 현재 상황으로는 약 {delay_min}분 지연될 것으로 보입니다.
        
        팀원들에게 보낼 상황별 메시지를 한국어로 작성해줘:
        1. 정중하고 공식적인 사과 메시지
        2. 친근한 팀원용 위트 있는 메시지
        
        응답 형식은 슬랙에 바로 올릴 수 있게 작성해줘.
        """
        try:
            if hasattr(self, 'model'):
                response = self.model.generate_content(prompt)
                return response.text
            else:
                return f"AI Model not loaded. Delay: {delay_min} mins."
        except Exception as e:
            return f"현재 교통 체증으로 인해 약 {delay_min}분 정도 늦을 것 같습니다. 죄송합니다. (AI 생성 오류)"

    def send_slack_message(self, message):
        """Send message to Slack"""
        if not self.slack_webhook_url:
            self.log("⚠️ Slack Webhook URL not set.")
            return False

        payload = {
            "text": "🚨 *Kkokki 지각 경보 알림* 🚨",
            "attachments": [
                {
                    "color": "#f2c744",
                    "text": message,
                    "footer": "Kkokki Autonomous Morning Orchestrator"
                }
            ]
        }
        
        try:
            response = requests.post(
                self.slack_webhook_url, 
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'}
            )
            if response.status_code == 200:
                self.log("✅ Slack message sent successfully.")
                return True
            else:
                self.log(f"❌ Slack send failed: {response.status_code} {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Slack error: {e}")
            return False

    def start_monitoring(self, start_name, end_name, arrival_time, transport_mode='car'):
        if self.is_running:
            self.log("Already running.")
            return

        self.is_running = True
        self.status = "준비 중..."
        self.transport_mode = transport_mode
        
        mode_names = {'car': '자동차', 'transit': '대중교통', 'walk': '도보'}
        mode_display = mode_names.get(transport_mode, transport_mode)
        
        def run_loop():
            try:
                self.log(f"설정 시작: {start_name} -> {end_name} ({arrival_time}) [{mode_display}]")
                
                # Geocoding
                try:
                    if isinstance(start_name, dict) and 'lat' in start_name:
                        start_coord = start_name
                    else:
                        start_coord = self.get_coordinates(start_name)
                        
                    if isinstance(end_name, dict) and 'lat' in end_name:
                        end_coord = end_name
                    else:
                        end_coord = self.get_coordinates(end_name)
                except Exception as e:
                    self.log(f"❌ 위치 검색 실패: {e}")
                    self.is_running = False
                    self.status = "위치 오류"
                    return

                self.log(f"좌표 변환 완료: {start_coord['name']} -> {end_coord['name']}")
                
                # Monitoring Loop
                while self.is_running:
                    self.status = "경로 분석 중..."
                    try:
                        route = self.calculate_route(start_coord, end_coord, transport_mode)
                        
                        now = datetime.now()
                        target = datetime.strptime(arrival_time, "%H:%M").replace(
                            year=now.year, month=now.month, day=now.day
                        )
                        if target < now: target += timedelta(days=1)

                        leave_home = target - timedelta(minutes=route["minutes"] + self.buffer_time)
                        wake_up = leave_home - timedelta(minutes=self.default_prep_time)
                        
                        delay = 0
                        is_late = False
                        
                        if now > wake_up:
                            is_late = True
                            delay = (now - wake_up).seconds // 60
                            self.status = f"⚠️ 지각 위험! ({delay}분 지연)"
                        else:
                            self.status = "✅ 정상 (대기 중)"

                        result = {
                            "timestamp": now.strftime("%H:%M:%S"),
                            "travel_time": route["minutes"],
                            "distance": route["distance"],
                            "wake_up_time": wake_up.strftime("%H:%M"),
                            "leave_time": leave_home.strftime("%H:%M"),
                            "arrival_time": target.strftime("%H:%M"),
                            "prep_time": self.default_prep_time,
                            "buffer_time": self.buffer_time,
                            "is_late": is_late,
                            "delay": delay
                        }
                        self.latest_result = result
                        
                        log_msg = f"이동: {route['minutes']}분, 기상 권장: {wake_up.strftime('%H:%M')}"
                        if is_late:
                            log_msg += f" (⚠️ {delay}분 늦음)"
                            self.log(log_msg)
                            
                            # Send Alert
                            if hasattr(self, 'model'):
                                msg = self.generate_delay_message(start_coord['name'], end_coord['name'], arrival_time, delay)
                                self.send_slack_message(msg)
                            
                            self.log("지각 알림 전송 완료. 모니터링을 종료합니다.")
                            self.is_running = False # Stop on late
                            self.status = "종료됨 (지각 알림 전송)"
                            break
                        else:
                            self.log(log_msg)

                    except Exception as e:
                        self.log(f"모니터링 중 오류: {e}")
                    
                    # Sleep for a bit
                    for _ in range(60): # Check every 60 seconds, but check stop flag
                        if not self.is_running: break
                        time.sleep(1)
            
            except Exception as e:
                self.log(f"치명적 오류: {e}")
                self.is_running = False
                self.status = "오류로 종료"

        self.monitor_thread = threading.Thread(target=run_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()

    def stop_monitoring(self):
        if self.is_running:
            self.is_running = False
            self.log("모니터링 종료 요청됨.")
            self.status = "종료 요청됨..."
            if self.monitor_thread:
                self.monitor_thread.join(timeout=2)
            self.status = "중지됨"
        else:
            self.log("실행 중인 모니터링이 없습니다.")

    def get_status(self):
        return {
            "is_running": self.is_running,
            "status": self.status,
            "logs": self.logs,
            "latest_result": self.latest_result
        }
