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

        # Configurable settings (can be updated at runtime via /api/start)
        self.prep_time = 30       # minutes to get ready
        self.buffer_time = 10     # extra buffer minutes
        self.early_warning_enabled = False
        self.early_warning_minutes = 5
        self.urgent_alert_enabled = True

        # Internal State
        self.is_running = False
        self.logs = []
        self.status = "STANDBY"
        self.latest_result = None
        self.monitor_thread = None
        self.slack_sent = False
        self.alarm_dismissed = False

        # API Setup
        if self.google_api_key:
            genai.configure(api_key=self.google_api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash-preview-09-2025')
        else:
            self.log("WARNING: GOOGLE_API_KEY is not set.")

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M")
        formatted_message = f"[{timestamp}] {message}"
        print(formatted_message)
        self.logs.append(formatted_message)
        if len(self.logs) > 50:
            self.logs.pop(0)

    # ─── POI / Geocoding ───────────────────────────────────────

    def get_coordinates(self, keyword):
        """Convert location name to coordinates (POI)"""
        url = f"{self.base_url}/pois"
        headers = {"appKey": self.sk_api_key, "Accept": "application/json"}
        params = {
            "version": 1, "format": "json",
            "searchKeyword": keyword,
            "resCoordType": "WGS84GEO", "count": 1
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
            "version": 1, "format": "json",
            "coordType": "WGS84GEO", "addressType": "A10",
            "lon": lon, "lat": lat
        }
        try:
            response = requests.get(url, headers=headers, params=params, verify=False)
            if response.status_code != 200:
                return {"name": "Selected Location", "address": f"{lat:.6f}, {lon:.6f}"}
            data = response.json()
            addr_info = data.get("addressInfo", {})
            full_addr = addr_info.get("fullAddress", "")
            building_name = addr_info.get("buildingName", "")
            name = building_name if building_name else "Selected Location"
            address = full_addr if full_addr else f"{lat:.6f}, {lon:.6f}"
            return {"name": name, "address": address}
        except Exception as e:
            self.log(f"Reverse geocode error: {e}")
            return {"name": "Selected Location", "address": f"{lat:.6f}, {lon:.6f}"}

    def search_locations(self, keyword):
        """Search for locations and return a list of candidates (POI)"""
        url = f"{self.base_url}/pois"
        headers = {"appKey": self.sk_api_key, "Accept": "application/json"}
        params = {
            "version": 1, "format": "json",
            "searchKeyword": keyword,
            "resCoordType": "WGS84GEO", "reqCoordType": "WGS84GEO",
            "count": 10
        }
        try:
            response = requests.get(url, headers=headers, params=params, verify=False)
            if response.status_code != 200:
                self.log(f"POI Search Failed: {response.status_code}")
                return []
            data = response.json()
            pois = data.get("searchPoiInfo", {}).get("pois", {}).get("poi", [])
            results = []
            for poi in pois:
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

    # ─── Route Calculation ─────────────────────────────────────

    def _extract_coordinates(self, features):
        """Extract polyline coordinates from TMap GeoJSON features"""
        coords = []
        for feature in features:
            geom = feature.get("geometry", {})
            if geom.get("type") == "LineString":
                coords.extend(geom["coordinates"])
            elif geom.get("type") == "Point":
                coords.append(geom["coordinates"])
        return coords

    def calculate_route(self, start, end, transport_mode='car'):
        if transport_mode == 'transit':
            return self.calculate_transit_route(start, end)
        elif transport_mode == 'walk':
            return self.calculate_walk_route(start, end)
        else:
            return self.calculate_car_route(start, end)

    def calculate_car_route(self, start, end):
        url = f"{self.base_url}/routes?version=1&format=json"
        headers = {"appKey": self.sk_api_key, "Content-Type": "application/json"}
        payload = {
            "startX": start["lon"], "startY": start["lat"],
            "endX": end["lon"], "endY": end["lat"],
            "reqCoordType": "WGS84GEO", "resCoordType": "WGS84GEO",
            "searchOption": "0", "trafficInfo": "Y"
        }
        response = requests.post(url, headers=headers, json=payload, verify=False)
        if response.status_code != 200:
            raise Exception(f"Car route calculation failed: {response.status_code}")

        data = response.json()
        features = data.get("features", [])
        props = features[0]["properties"]
        coordinates = self._extract_coordinates(features)

        return {
            "mode": "car",
            "minutes": round(int(props["totalTime"]) / 60),
            "distance": round(int(props["totalDistance"]) / 1000, 1),
            "coordinates": coordinates
        }

    def calculate_walk_route(self, start, end):
        url = f"{self.base_url}/routes/pedestrian?version=1&format=json"
        headers = {"appKey": self.sk_api_key, "Content-Type": "application/json"}
        payload = {
            "startX": str(start["lon"]), "startY": str(start["lat"]),
            "endX": str(end["lon"]), "endY": str(end["lat"]),
            "reqCoordType": "WGS84GEO", "resCoordType": "WGS84GEO",
            "startName": start.get("name", "Start"),
            "endName": end.get("name", "End")
        }
        try:
            response = requests.post(url, headers=headers, json=payload, verify=False)
            if response.status_code != 200:
                raise Exception(f"Walk route calculation failed: {response.status_code}")

            data = response.json()
            if "features" not in data or len(data["features"]) == 0:
                raise Exception("Invalid walk API response format")

            features = data["features"]
            props = features[0]["properties"]
            coordinates = self._extract_coordinates(features)

            return {
                "mode": "walk",
                "minutes": round(props.get("totalTime", 0) / 60),
                "distance": round(props.get("totalDistance", 0) / 1000, 1),
                "coordinates": coordinates
            }
        except Exception as e:
            self.log(f"Walk route error: {e}")
            raise

    def calculate_transit_route(self, start, end):
        url = "https://apis.openapi.sk.com/transit/routes/sub/"
        headers = {
            "appKey": self.sk_api_key,
            "accept": "application/json",
            "content-type": "application/json"
        }
        now = datetime.now()
        payload = {
            "startX": str(start["lon"]), "startY": str(start["lat"]),
            "endX": str(end["lon"]), "endY": str(end["lat"]),
            "format": "json", "count": 10,
            "searchDttm": now.strftime("%Y%m%d%H%M")
        }
        try:
            response = requests.post(url, headers=headers, json=payload, verify=False)
            if response.status_code != 200:
                raise Exception(f"Transit route calculation failed: {response.status_code}")

            data = response.json()
            if "metaData" not in data or "plan" not in data["metaData"]:
                raise Exception("Invalid transit API response format")

            itineraries = data["metaData"]["plan"].get("itineraries", [])
            if not itineraries:
                raise Exception("No transit routes found")

            itineraries_sorted = sorted(itineraries, key=lambda x: x.get("totalTime", 999999))
            best = itineraries_sorted[0]

            total_fare = best.get("fare", {}).get("regular", {}).get("totalFare", 0)
            path_type = best.get("pathType", 0)
            path_type_names = {1: "Subway", 2: "Bus", 3: "Bus+Subway"}

            route_options = []
            for idx, route in enumerate(itineraries_sorted[:5]):
                pt = route.get("pathType", 0)
                route_options.append({
                    "index": idx + 1,
                    "minutes": round(route.get("totalTime", 0) / 60),
                    "transfers": route.get("transferCount", 0),
                    "fare": route.get("fare", {}).get("regular", {}).get("totalFare", 0),
                    "type": path_type_names.get(pt, "Transit"),
                    "walk_minutes": round(route.get("totalWalkTime", 0) / 60)
                })

            return {
                "mode": "transit",
                "minutes": round(best.get("totalTime", 0) / 60),
                "distance": round(best.get("totalDistance", 0) / 1000, 1),
                "fare": total_fare,
                "transfers": best.get("transferCount", 0),
                "walk_minutes": round(best.get("totalWalkTime", 0) / 60),
                "path_type": path_type_names.get(path_type, "Transit"),
                "route_options": route_options,
                "coordinates": []  # Transit API doesn't return polyline
            }
        except Exception as e:
            self.log(f"Transit route error: {e}")
            raise

    # ─── AI & Notifications ────────────────────────────────────

    def generate_delay_message(self, start, end, target_time, delay_min):
        prompt = f"""
        사용자가 현재 교통 정체로 인해 지각이 예상됩니다.
        상황: {start}에서 {end}로 이동 중이며, 목표 도착 시간은 {target_time}이지만 약 {delay_min}분 지연 예상.
        팀원들에게 보낼 간결한 슬랙 메시지를 한국어로 작성해줘 (이모지 포함).
        """
        try:
            if hasattr(self, 'model'):
                response = self.model.generate_content(prompt)
                return response.text
            else:
                return f"교통 체증으로 약 {delay_min}분 늦을 예정입니다."
        except Exception:
            return f"현재 교통 체증으로 인해 약 {delay_min}분 정도 늦을 것 같습니다. 죄송합니다."

    def send_slack_message(self, message):
        if not self.slack_webhook_url:
            self.log("Slack Webhook URL not set.")
            return False
        payload = {
            "text": "*Kkokki Late Alert*",
            "attachments": [{
                "color": "#f2c744",
                "text": message,
                "footer": "Kkokki Digital Rooster"
            }]
        }
        try:
            response = requests.post(
                self.slack_webhook_url,
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'}
            )
            if response.status_code == 200:
                self.log("Slack: Message sent!")
                return True
            else:
                self.log(f"Slack send failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"Slack error: {e}")
            return False

    # ─── Monitoring ────────────────────────────────────────────

    def start_monitoring(self, start_name, end_name, arrival_time, transport_mode='car'):
        if self.is_running:
            self.log("Already running.")
            return

        self.is_running = True
        self.status = "INITIALIZING"
        self.transport_mode = transport_mode
        self.slack_sent = False
        self.alarm_dismissed = False

        mode_names = {'car': 'Driving', 'transit': 'Transit', 'walk': 'Walking'}
        mode_display = mode_names.get(transport_mode, transport_mode)

        def run_loop():
            try:
                self.log(f"Tmap: Route set [{mode_display}]")

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
                    self.log(f"Location error: {e}")
                    self.is_running = False
                    self.status = "LOCATION_ERROR"
                    return

                s_name = start_coord.get('name', 'Start')
                e_name = end_coord.get('name', 'End')
                self.log(f"Tmap: {s_name} -> {e_name}")

                # Monitoring Loop
                while self.is_running:
                    self.status = "MONITORING"
                    try:
                        route = self.calculate_route(start_coord, end_coord, transport_mode)

                        now = datetime.now()
                        target = datetime.strptime(arrival_time, "%H:%M").replace(
                            year=now.year, month=now.month, day=now.day
                        )
                        if target < now:
                            target += timedelta(days=1)

                        travel_min = route["minutes"]
                        departure_time = target - timedelta(minutes=travel_min)
                        wake_up_time = departure_time - timedelta(minutes=self.prep_time + self.buffer_time)

                        # Time calculations
                        seconds_until_departure = (departure_time - now).total_seconds()
                        seconds_until_wake = (wake_up_time - now).total_seconds()

                        is_late = False
                        delay = 0
                        early_warning_active = False

                        if seconds_until_wake <= 0:
                            is_late = True
                            delay = abs(int(seconds_until_wake // 60))
                            self.status = "LATE_RISK"
                        else:
                            self.status = "MONITORING"

                        # Early warning check
                        if self.early_warning_enabled and 0 < seconds_until_wake <= self.early_warning_minutes * 60:
                            early_warning_active = True

                        result = {
                            "timestamp": now.strftime("%H:%M:%S"),
                            "travel_minutes": travel_min,
                            "distance": route["distance"],
                            "wake_up_time": wake_up_time.strftime("%H:%M"),
                            "leave_time": departure_time.strftime("%H:%M"),
                            "arrival_time": target.strftime("%H:%M"),
                            "prep_time": self.prep_time,
                            "buffer_time": self.buffer_time,
                            "is_late": is_late,
                            "delay": delay,
                            "seconds_until_departure": max(0, int(seconds_until_departure)),
                            "seconds_until_wake": max(0, int(seconds_until_wake)),
                            "early_warning_active": early_warning_active,
                        }
                        self.latest_result = result

                        log_msg = f"Tmap: {travel_min}min travel | Wake {wake_up_time.strftime('%H:%M')}"
                        if is_late:
                            log_msg = f"Tmap: LATE RISK! {delay}min overdue"
                            self.log(log_msg)

                            # Send Slack once
                            if not self.slack_sent and self.urgent_alert_enabled:
                                if hasattr(self, 'model'):
                                    msg = self.generate_delay_message(
                                        s_name, e_name, arrival_time, delay)
                                    self.send_slack_message(msg)
                                self.slack_sent = True
                                self.log("Kkokki: Late alert sent!")
                        else:
                            self.log(log_msg)

                    except Exception as e:
                        self.log(f"Monitor error: {e}")

                    # Sleep 60s, checking stop flag each second
                    for _ in range(60):
                        if not self.is_running:
                            break
                        time.sleep(1)

            except Exception as e:
                self.log(f"Fatal error: {e}")
                self.is_running = False
                self.status = "ERROR"

        self.monitor_thread = threading.Thread(target=run_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()

    def stop_monitoring(self):
        if self.is_running:
            self.is_running = False
            self.log("Kkokki: Monitoring stopped.")
            self.status = "STOPPED"
            if self.monitor_thread:
                self.monitor_thread.join(timeout=2)
            self.status = "STANDBY"
        else:
            self.log("No active monitoring.")

    def get_status(self):
        return {
            "is_running": self.is_running,
            "status": self.status,
            "logs": self.logs[-10:],  # Last 10 logs for display
            "latest_result": self.latest_result
        }
