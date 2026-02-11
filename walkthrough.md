# Kkokki: World Map Quest Edition 사용 가이드

## 개요
Kkokki가 **World Map Quest** 스타일로 완전히 변신했습니다!
전체 화면 지도 위에서 탐험하듯 경로를 설정하고, 하단의 퀘스트 카드를 통해 실시간 상태를 확인할 수 있습니다.

## 주요 변경 사항

### 1. Full-Screen Map Interface (전체 화면 지도)
- **Immersive Map**: 전체 화면을 꽉 채우는 어두운 테마의 지도 위에서 직관적으로 위치를 탐색합니다.
- **Search Header**: 상단의 검색바를 통해 POI를 검색하면 지도에 핀이 꽂힙니다.

### 2. Quest Card Overlay (퀘스트 카드)
- **Bottom Panel**: 하단에 위치한 카드 UI에서 경로 정보(소요 시간, 도착지)를 한눈에 볼 수 있습니다.
- **Dynamic Thumbnail**:
    - **Normal**: 맑은 날씨의 픽셀 아트 썸네일.
    - **Danger**: 지각 위험 시 폭설이 내리는 썸네일로 변경되며 붉은 경고등이 켜집니다.

### 3. Transport Modes (교통 수단)
- 하단의 `CAR`, `SUBWAY`, `BIKE` 버튼을 통해 이동 수단을 선택할 수 있습니다 (현재는 UI만 구현됨).

## 사용 방법
1.  **서버 실행**:
    ```bash
    conda activate agent_env
    python app.py
    ```
2.  **경로 설정**:
    - 상단 검색바에 장소(예: "강남역")를 검색합니다.
    - 지도에 핀이 나타나면 클릭하여 **'Destination'**으로 설정합니다.
    - (현재 버전에서는 출발지가 자동으로 'Current' 또는 '파크시엘아파트'로 설정됩니다)
3.  **퀘스트 시작**:
    - 하단의 `START ADVENTURE` 버튼을 누르면 모니터링이 시작됩니다.
    - 카드의 상태 메시지와 썸네일이 실시간으로 업데이트됩니다.
