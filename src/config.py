"""모델 설정 및 전역 변수 (Gemini 1.5 Flash 등)."""
import os
from dotenv import load_dotenv

load_dotenv()

# Gemini
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
MODEL_NAME = "gemini-2.5-flash-lite" 

# (실제 연동 시) Google Maps, Firebase, Slack 등 추가 키
# MAPS_API_KEY = os.getenv("MAPS_API_KEY", "")
# SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
