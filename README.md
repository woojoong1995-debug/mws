# C&Tech 창고 재고 관리 시스템

## 폴더 구조
```
warehouse_management/
├── backend/
│   ├── main.py        ← 서버 실행 파일 (여기서 시작!)
│   ├── database.py    ← 데이터 저장/불러오기
│   ├── inbound.py     ← 입고 API
│   ├── outbound.py    ← 불출 API
│   ├── returns.py     ← 환입 API
│   ├── inventory.py   ← 재고 조회 API
│   └── data.json      ← 실제 데이터 (자동 생성)
├── frontend/
│   ├── index.html     ← 앱 화면
│   └── logo.jpg       ← 회사 로고
└── README.md
```

## 실행 방법

### 1. 패키지 설치 (처음 한 번만)
```bash
cd warehouse_management
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors
```

### 2. 서버 실행
```bash
cd backend
python3 main.py
```

### 3. 접속
- 컴퓨터: http://localhost:5000
- 폰/태블릿: http://[컴퓨터IP]:5000
  - 반드시 같은 와이파이 연결 필요
  - Mac IP 확인: ifconfig | grep "inet "
  - Windows IP 확인: ipconfig

### 4. 다음에 서버 켤 때
```bash
cd warehouse_management
source venv/bin/activate
cd backend
python3 main.py
```

## OCR 사용하려면
1. https://console.anthropic.com 에서 API 키 발급
2. frontend/index.html 에서 아래 두 줄 주석 해제:
   // 'x-api-key': 'sk-ant-여기에키입력',
   // 'anthropic-version': '2023-06-01',

## 주요 기능
- 입고: 일반/원단, D동/천막동, 렉/바닥 보관
- 불출: 품번 끝자리 검색 → 선입선출 순서 확인 → 항목 선택 → 확정
- 환입: 사용 후 남은 원자재 반납 (불출 1순위)
- 재고: 카테고리 필터, 검색, 소진 항목 자동 정리
- 이력: 담당자별 불출 기록, 취소 가능
- OCR: 식별표 사진으로 자동 입력 (API 키 필요)
- CSV 내보내기
