"""Google Calendar (Schedule) 연동. 실연 시 Calendar API로 교체."""
from src.utils.logger import get_logger

logger = get_logger(__name__)


def get_calendar_schedule(
    date: str | None = None,
    user_id: str = "default",
) -> dict:
    """
    오늘(또는 지정일)의 첫 공식 일정을 반환합니다.
    실제 구현: Google Calendar API 호출.
    """
    logger.info("[Tool 호출 전] get_calendar_schedule(date=%s, user_id=%s)", date or "today", user_id)
    # 해커톤용 Mock: 중요한 발표/회의 시나리오
    result = {
        "first_event": {
            "title": "중요 발표 (Q1 전략)",
            "start": "09:00",
            "end": "10:00",
            "location": "본사 3층",
        },
        "date": date or "today",
    }
    ev = result.get("first_event") or {}
    logger.info("[Tool 호출 후] get_calendar_schedule → 첫 일정: %s %s (%s)", ev.get("start"), ev.get("title"), ev.get("location"))
    return result


def calculate_optimal_wakeup(
    first_event_time: str,
    commute_minutes: int,
    buffer_minutes: int = 15,
    weather_delay_minutes: int = 0,
) -> dict:
    """
    첫 일정 시각, 출퇴근 소요시간, 버퍼, 날씨 지연을 반영해 최종 기상 시간을 계산합니다.
    """
    logger.info(
        "[Tool 호출 전] calculate_optimal_wakeup(event=%s, commute=%d분, buffer=%d분, weather_delay=%d분)",
        first_event_time,
        commute_minutes,
        buffer_minutes,
        weather_delay_minutes,
    )
    # 간단 Mock: "09:00" → 08:00 - commute - buffer - weather_delay
    total_minutes_before = commute_minutes + buffer_minutes + weather_delay_minutes
    # "09:00" 파싱 (간단)
    h, m = 9, 0
    if ":" in first_event_time:
        parts = first_event_time.strip().split(":")
        h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
    total_m = h * 60 + m - total_minutes_before
    wake_h, wake_m = total_m // 60, total_m % 60
    if wake_m < 0:
        wake_m += 60
        wake_h -= 1
    result = {
        "optimal_wakeup_time": f"{wake_h:02d}:{wake_m:02d}",
        "reason": f"첫 일정 {first_event_time}, 통근 {commute_minutes}분, 버퍼 {buffer_minutes}분, 날씨 지연 {weather_delay_minutes}분 반영 (Mock)",
    }
    logger.info("[Tool 호출 후] calculate_optimal_wakeup → 기상 시각: %s", result["optimal_wakeup_time"])
    return result
