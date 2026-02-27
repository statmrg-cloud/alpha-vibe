# Alpha-Vibe | AI Investment Agent Terminal

> AI 기반 금융 투자 에이전트 터미널 — Claude AI + 실시간 시세 + 자동매매

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Claude](https://img.shields.io/badge/Claude_AI-Sonnet_4-orange)
![Alpaca](https://img.shields.io/badge/Alpaca-Paper_Trading-yellow)

## 주요 기능

| 기능 | 설명 |
|------|------|
| **AI 투자 분석** | Claude Sonnet이 월가 헤지펀드 전략가로 종목 분석 |
| **실시간 시세** | Yahoo Finance REST API 실시간 주가 데이터 |
| **모의투자 (KR/US)** | 1억원 가상 자금으로 한국+미국 주식 매수/매도 연습 |
| **USD→KRW 환율 자동 반영** | 미국 주식 모의투자 시 실시간 환율로 원화 환산 |
| **Alpaca 실매매 (US)** | Paper Trading API로 미국 주식 실제 시장가 주문 |
| **자동매매 (US ONLY)** | 10분 간격 기술적 지표 + AI 분석 → 미국 주식 자동 매수 |
| **주가 차트** | 7일 주가 추이 (상승=초록, 하락=빨간) |
| **Alpaca 계좌 패널** | 설정에서 활성화하여 Alpaca 계좌 잔고/포지션 확인 |
| **일일 손실 제한** | Stop-loss 자동 중지 기능 |

## 화면 구성

```
┌──────────────────────────────────┬──────────────────────┐
│  AI TERMINAL                     │  PRICE CHART (7D)    │
│  > AAPL 투자 분석                │  ████████▓░░  +3.9%  │
│                                  ├──────────────────────┤
│  📊 Apple (AAPL) 투자 분석       │  PORTFOLIO           │
│  【1. 투자 등급】 🟡 보유(HOLD)  │  100,000,000 KRW     │
│  【2. 핵심 근거 3가지】          ├──────────────────────┤
│  ① PER 34배 고평가              │  AUTO TRADE [ACTIVE] │
│  ② 기술적 모멘텀 양호            │  ●━━━ 2종목 체크 중   │
│  【3. 리스크 요인】              ├──────────────────────┤
│  ⚠️ 중국 시장 리스크             │  WATCHLIST           │
│                                  │  AAPL  $274.23 ▲3.9% │
│  [매수] [매도] [실매수] [실매도]  │  NVDA  $131.28 ▼2.1% │
└──────────────────────────────────┴──────────────────────┘
```

---

## 빠른 시작

### Windows 사용자 (초간단)

1. **[Node.js](https://nodejs.org/)** 설치 (LTS 버전 다운로드 → 설치)
2. 이 저장소를 **[Download ZIP]** 또는 `git clone`
3. 폴더 안의 **`setup.bat`** 더블클릭 → 자동 설치
4. **`.env.local`** 파일을 메모장으로 열어서 API 키 입력
5. **`start.bat`** 더블클릭 → 서버 시작
6. 브라우저에서 **http://localhost:3000** 접속

### macOS / Linux 사용자

```bash
# 1. 저장소 clone
git clone https://github.com/YOUR_USERNAME/alpha-vibe.git
cd alpha-vibe

# 2. 패키지 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 API 키 입력

# 4. 서버 시작
npm run dev

# 5. 브라우저에서 http://localhost:3000 접속
```

---

## API 키 발급 방법

이 프로젝트를 사용하려면 2개의 API 키가 필요합니다:

### 1. Anthropic Claude API (AI 분석용)

1. [console.anthropic.com](https://console.anthropic.com/) 에서 회원가입
2. **API Keys** 메뉴에서 새 키 생성
3. `.env.local`의 `ANTHROPIC_API_KEY`에 붙여넣기

### 2. Alpaca Paper Trading API (주문 실행용)

1. [app.alpaca.markets](https://app.alpaca.markets/) 에서 회원가입
2. 좌측 메뉴에서 **Paper Trading** 선택
3. **API Keys** 에서 Key + Secret 생성
4. `.env.local`의 `ALPACA_API_KEY`와 `ALPACA_API_SECRET`에 붙여넣기

---

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일**: Tailwind CSS + shadcn/ui
- **AI**: Anthropic Claude Sonnet 4
- **주가 데이터**: Yahoo Finance REST API + Alpaca Data API
- **차트**: Recharts (AreaChart)
- **자동매매**: node-cron + 기술적 지표 (RSI, MACD, SMA, 볼린저밴드)
- **매매**: Alpaca Paper Trading API
- **상태관리**: React Context + localStorage

## 프로젝트 구조

```
alpha-vibe/
├── setup.bat / start.bat       # Windows 간편 실행
├── .env.example                # 환경 변수 템플릿
├── .env.local                  # API 키 (git 제외됨)
├── src/
│   ├── app/
│   │   ├── page.tsx            # 메인 페이지
│   │   └── api/
│   │       ├── stock/          # 주가 데이터 API
│   │       ├── chat/           # AI 분석 API
│   │       ├── trade/          # Alpaca 주문/계좌/포지션 API
│   │       ├── exchange-rate/  # USD/KRW 환율 API
│   │       └── autotrade/      # 자동매매 API
│   ├── components/             # UI 컴포넌트
│   ├── lib/autotrade/          # 자동매매 엔진 + 기술적 지표
│   └── hooks/                  # 포트폴리오 훅
├── MANUAL.md                   # 상세 사용자 매뉴얼 (한글)
└── README.md
```

## 상세 매뉴얼

자세한 사용법은 **[MANUAL.md](./MANUAL.md)** 를 참고하세요.

---

## 주의사항

- 이 프로젝트는 **교육/연습 목적**입니다
- AI 분석은 참고용이며, 투자 판단의 최종 책임은 투자자에게 있습니다
- Alpaca Paper Trading은 실제 자금이 이동하지 않는 모의매매입니다
- `.env.local` 파일은 절대 공유하거나 Git에 커밋하지 마세요

## License

MIT
