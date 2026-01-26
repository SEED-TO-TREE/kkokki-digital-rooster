"""Slack, Gmail, Push 알림 연동. 실연 시 웹훅/API로 교체."""
from src.utils.logger import get_logger

logger = get_logger(__name__)


def set_dynamic_alarm(
    wakeup_time: str,
    user_id: str = "default",
) -> dict:
    """
    동적 기상 알람을 설정합니다.
    실제 구현: Firebase Cloud Messaging / 앱 로컬 알람 API 등.
    """
    logger.info("[Tool 호출 전] set_dynamic_alarm(wakeup_time=%s, user=%s)", wakeup_time, user_id)
    result = {
        "success": True,
        "message": f"알람이 {wakeup_time}으로 설정되었습니다. (Mock)",
        "scheduled_at": wakeup_time,
    }
    logger.info("[Tool 호출 후] set_dynamic_alarm → %s", result["message"])
    return result


def send_team_notification(
    message: str,
    channel: str = "slack",
    expected_arrival: str | None = None,
) -> dict:
    """
    지각 예상 시 팀원에게 상황 및 예상 도착 시간을 전송합니다.
    실제 구현: Slack Incoming Webhook / Gmail API 등.
    """
    logger.info("[Tool 호출 전] send_team_notification(channel=%s, message=%s)", channel, message[:50] + "..." if len(message) > 50 else message)
    body = message
    if expected_arrival:
        body += f" 예상 도착: {expected_arrival}"
    result = {
        "success": True,
        "channel": channel,
        "message_sent": body,
        "note": "Mock 전송 (실제 API 미연동)",
    }
    logger.info("[Tool 호출 후] send_team_notification → channel=%s, sent=%s", result["channel"], result["message_sent"][:60] + "..." if len(result["message_sent"]) > 60 else result["message_sent"])
    return result
