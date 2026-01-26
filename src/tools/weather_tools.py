"""날씨 API 연동 및 이동 시간 영향 분석. 실연 시 Weather API로 교체."""
from src.utils.logger import get_logger

logger = get_logger(__name__)


def get_weather_impact(
    region: str = "서울",
    conditions: str | None = None,
) -> dict:
    """
    눈, 비 등 기상 변수가 이동 시간에 줄 영향을 수치(추가 소요 분)로 반환합니다.
    실제 구현: OpenWeatherMap / 기상청 API 등.
    """
    logger.info("[Tool 호출 전] get_weather_impact(region=%s, conditions=%s)", region, conditions)
    conditions = (conditions or "").lower()
    if "눈" in conditions or "폭설" in conditions or "snow" in conditions:
        delay = 20
        summary = "폭설로 인해 평소보다 약 20분 일찍 출발 권장 (Mock)"
    elif "비" in conditions or "rain" in conditions:
        delay = 10
        summary = "강우로 인해 약 10분 추가 소요 예상 (Mock)"
    else:
        delay = 0
        summary = "기상 영향 없음 (Mock)"
    result = {
        "additional_minutes": delay,
        "summary": summary,
        "conditions": conditions or "clear",
    }
    logger.info("[Tool 호출 후] get_weather_impact → 추가 소요 %d분, %s", result["additional_minutes"], result["summary"])
    return result
