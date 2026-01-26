"""Google Maps (Traffic, Route, ETA) 연동. 실연 시 Routes API로 교체."""
from src.utils.logger import get_logger

logger = get_logger(__name__)


def get_realtime_traffic(
    origin: str = "사용자_집",
    destination: str = "목적지_회사",
    departure_time: str | None = None,
) -> dict:
    """
    목적지까지의 현재 소요 시간(분) 및 교통 상황을 반환합니다.
    실제 구현: Google Maps Platform Routes API 호출.
    """
    logger.info("[Tool 호출 전] get_realtime_traffic(origin=%s, destination=%s)", origin, destination)
    result = {
        "duration_minutes": 45,
        "status": "heavy_traffic",
        "message": "평소 대비 약 15분 추가 소요 예상 (Mock 데이터)",
    }
    logger.info("[Tool 호출 후] get_realtime_traffic → 소요 %d분, %s", result["duration_minutes"], result["message"])
    return result


def check_user_movement(
    user_id: str = "default",
    current_speed_kmh: float | None = None,
    expected_arrival_minutes: int | None = None,
) -> dict:
    """
    사용자 이동 속도/위치를 모니터링하고, 지각 위험 시 대안을 제안합니다.
    실제 구현: 모바일/웹 위치·속도 스트림 연동.
    """
    logger.info("[Tool 호출 전] check_user_movement(user=%s, speed=%s, expected_arrival=%s분)", user_id, current_speed_kmh, expected_arrival_minutes)
    speed = current_speed_kmh or 3.0
    on_track = speed >= 3.0 and (expected_arrival_minutes or 30) <= 35
    result = {
        "on_track": on_track,
        "current_speed_kmh": speed,
        "suggestion": None if on_track else "대안 경로 또는 속도 향상을 권장합니다. (Mock)",
    }
    logger.info("[Tool 호출 후] check_user_movement → on_track=%s, suggestion=%s", result["on_track"], result["suggestion"])
    return result
