"""에이전트 실행 및 데모 엔트리 포인트."""
import asyncio
from dotenv import load_dotenv

from google.adk.runners import InMemoryRunner

from src.agents import app
from src.utils import events_to_text

load_dotenv()

# 데모용 기본 질의 (해커톤 시연 시 이 메시지로 동작 확인)
DEFAULT_QUERY = (
    "오늘 오전 9시에 중요한 발표가 있어. 밖에는 눈이 오고 있네. 나 언제 깨울 거야?"
)
# 2턴: 사용자 승인 → 알람 설정으로 이어지는 멀티턴 데모
FOLLOW_UP_APPROVE = "그래, 그렇게 해줘."


async def main():
    runner = InMemoryRunner(app=app)
    try:
        # 1턴: 기상 시간 제안
        response1 = await runner.run_debug(DEFAULT_QUERY)
        print("\n--- Kkokki 응답 (1턴) ---")
        print(events_to_text(response1))

        # 2턴: 같은 Runner에서 승인 메시지 → 알람 설정 액션 (세션 유지는 Runner 내부 정책 따름)
        response2 = await runner.run_debug(FOLLOW_UP_APPROVE)
        print("\n--- Kkokki 응답 (2턴) ---")
        print(events_to_text(response2))
    except Exception as e:
        print(f"에이전트 실행 중 오류: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
