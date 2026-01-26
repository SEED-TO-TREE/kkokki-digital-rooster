"""에이전트 응답(Event)에서 텍스트 추출 등."""


def events_to_text(response, empty_fallback: str = "(도구 호출만 수행되었습니다. 최종 텍스트 응답이 없습니다.)") -> str:
    """run_debug 응답(Event 또는 Event 리스트)에서 모델 응답 텍스트만 추출."""
    events = response if isinstance(response, list) else [response]
    texts = []
    for event in events:
        if getattr(event, "content", None) and getattr(event.content, "parts", None):
            for part in event.content.parts:
                if getattr(part, "text", None):
                    texts.append(part.text.strip())
    return "\n\n".join(texts) if texts else empty_fallback
