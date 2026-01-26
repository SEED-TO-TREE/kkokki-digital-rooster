"""해커톤 시연용 시나리오 테스트 — 폭설/지각 위기 등 가상 데이터로 에이전트 논리 검증."""
import asyncio
import os
import sys

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
from google.adk.runners import InMemoryRunner

from src.agents import app
from src.utils import events_to_text

load_dotenv()


async def run_scenario(name: str, query: str) -> None:
    """단일 시나리오 실행 후 응답 출력."""
    print(f"\n{'='*60}")
    print(f" 시나리오: {name}")
    print(f" 질의: {query}")
    print("=" * 60)
    runner = InMemoryRunner(app=app)
    try:
        response = await runner.run_debug(query)
        print("\n[Kkokki 응답]")
        print(events_to_text(response))
    except Exception as e:
        print(f"[오류] {e}")


async def test_heavy_snow():
    """폭설 상황: 평소보다 일찍 기상 제안 확인."""
    await run_scenario(
        "폭설 상황",
        "오늘 오전 9시에 중요한 발표가 있어. 밖에는 눈이 오고 있네. 나 언제 깨울 거야?",
    )


async def test_late_crisis():
    """지각 위기 상황: 팀 알림 + 대안 경로 등 예외 처리 확인."""
    await run_scenario(
        "지각 위기 상황",
        "지금 출발했는데 교통사고로 막혀서 9시 회의에 늦을 것 같아. 팀한테 좀 말해줘.",
    )


async def test_normal_morning():
    """일반 아침: 캘린더·교통 반영한 기상 시간 제안."""
    await run_scenario(
        "일반 아침",
        "오늘 첫 일정이 10시 회의야. 나 몇 시에 일어나면 돼?",
    )


if __name__ == "__main__":
    import sys

    scenario = (sys.argv[1] if len(sys.argv) > 1 else "snow").lower()
    if scenario == "snow":
        asyncio.run(test_heavy_snow())
    elif scenario == "late":
        asyncio.run(test_late_crisis())
    elif scenario == "normal":
        asyncio.run(test_normal_morning())
    else:
        print("Usage: python -m tests.test_scenarios [snow|late|normal]")
        asyncio.run(test_heavy_snow())
