# Architecture — 24hr Online Workplace

## 1. Overview

브라우저 기반의 가상 공동 작업 공간. 사용자가 입실/퇴실하여 실시간 접속 현황을 공유하고, 임베디드 화상회의로 함께 작업하는 느낌을 제공한다.

---

## 2. Tech Stack

| Layer | Technology | 비고 |
|-------|-----------|------|
| Runtime | Browser (no build step) | Babel standalone 런타임 JSX 트랜스파일 |
| UI | React 18 (CDN, UMD) | `react.production.min.js` |
| Auth | Firebase Auth | Google OAuth (popup + redirect fallback) |
| Database | Firebase Realtime Database | WebSocket 기반 실시간 동기화 |
| Video | JaaS (Jitsi as a Service, 8x8.vc) | `JitsiMeetExternalAPI` iframe embed |
| Styling | Vanilla CSS | CSS custom properties 기반 디자인 토큰 |
| Hosting | Vercel | 정적 파일 서빙, 별도 빌드 파이프라인 없음 |

빌드 도구 없음 — 번들러, 패키지 매니저, node_modules 없이 CDN 직접 로드로 동작.

---

## 3. File Structure

```
.
├── index.html              # Entry point. CDN 스크립트 로드 + <div id="root">
├── app.js                  # 전체 애플리케이션 로직 (단일 파일)
├── style.css               # 전체 스타일시트
├── firebase-setup-guide.md # Firebase 초기 설정 가이드
├── ARCHITECTURE.md         # 이 문서
├── USE-CASES.md            # 주요 기능 흐름 문서
└── .gitignore
```

### app.js 내부 구조

```
CONFIG                    # Firebase/JaaS 설정 상수
Firebase Init             # firebase.initializeApp, db/auth 인스턴스
Helpers                   # formatDuration, formatTime, formatDateTime, getAvatarEmoji
Toast Component           # 토스트 알림 컴포넌트
App Component             # 메인 컴포넌트 (모든 상태 + 로직)
MemberDuration Component  # 멤버별 개별 경과 시간 타이머
ReactDOM.createRoot       # 렌더 엔트리
```

---

## 4. Data Model (Firebase Realtime Database)

```
workspace/
├── currentMembers/
│   └── {pushKey}/
│       ├── uid: string           # user.uid (세션 매칭용)
│       ├── nickname: string      # user.displayName
│       ├── photoURL: string      # Google profile photo
│       └── enteredAt: number     # Date.now() timestamp
│
└── log/
    └── {pushKey}/
        ├── nickname: string
        ├── photoURL: string
        ├── action: "enter" | "exit"
        └── timestamp: number     # Date.now() 또는 ServerValue.TIMESTAMP
```

- **currentMembers**: 현재 접속자. 입실 시 `push()`, 퇴실 시 `remove()`. `onDisconnect().remove()`로 비정상 종료 시 자동 정리.
- **log**: 입퇴실 기록. 클라이언트가 읽을 때 7일 초과 항목 자동 삭제 (의도된 설계). `limitToLast(100)` 쿼리.

### Security Rules

```json
{
  "rules": {
    "workspace": {
      "currentMembers": { ".read": true, ".write": true },
      "log": { ".read": "auth !== null", ".write": true }
    }
  }
}
```

`currentMembers`는 공개 읽기/쓰기. `log`는 인증된 사용자만 읽기, 쓰기는 전체 허용.

---

## 5. Component Architecture

```
App (단일 컴포넌트, 모든 상태 보유)
├── Header
├── Config Banner (Firebase 미설정 시)
├── Auth/CheckIn Card
│   ├── Google Login (미인증)
│   └── User Bar + 입실/퇴실 버튼 (인증됨)
├── Jitsi Video Card (입실 중)
├── Two-Column Layout (인증됨)
│   ├── Member List
│   │   └── MemberDuration (개별 타이머 컴포넌트)
│   └── Activity Log
├── Info Card (사용 안내)
├── Footer
└── Toast
```

상태 관리는 `App`의 `useState`로 단일 레벨 처리. Context나 외부 상태 라이브러리 없음.

---

## 6. Design System

CSS custom properties 기반 디자인 토큰 (`style.css :root`):

- **색상 팔레트**: 따뜻한 톤 (cream, beige, brown 계열) + 기능색 (green=활성, orange=강조, red=퇴실)
- **타이포그래피**: Noto Sans KR (300-700), 13-20px range
- **레이아웃**: 단일 컬럼 720px max-width, 2열 그리드 (접속자 + 로그)
- **반응형**: 600px 이하 2열->1열, 480px 이하 추가 축소

---

## 7. Deployment

정적 파일 3개 (`index.html`, `app.js`, `style.css`)를 Vercel에서 서빙. 빌드 과정 없음.

---

## 8. Data Flow Diagram

```
┌─────────────┐     Google OAuth      ┌──────────────────┐
│   Browser    │ ◄──────────────────► │  Firebase Auth    │
│              │                       └──────────────────┘
│  React App   │
│  (app.js)    │     WebSocket         ┌──────────────────┐
│              │ ◄──────────────────► │  Firebase RTDB    │
│              │   .on('value')        │                  │
│              │   .push() / .remove() │  /currentMembers │
│              │   .onDisconnect()     │  /log            │
│              │                       └──────────────────┘
│              │
│  ┌────────┐  │     iframe (postMsg)  ┌──────────────────┐
│  │ Jitsi  │  │ ◄──────────────────► │  8x8.vc (JaaS)   │
│  │ iframe │  │                       │  WebRTC SFU      │
│  └────────┘  │                       └──────────────────┘
└─────────────┘
     ▲
     │ sessionStorage
     │ (입실 상태 persist)
     ▼
  Browser Storage
```

---

## 9. Known Limitations

| 항목 | 설명 | 심각도 |
|------|------|--------|
| Firebase 설정값 하드코딩 | API 키가 소스코드에 직접 노출 (단, Firebase 웹 API 키는 공개 설계) | Low |
| Babel standalone | 런타임 JSX 변환으로 초기 로딩 시 파싱 오버헤드 | Low |
| 단일 파일 구조 | app.js에 모든 로직 — 기능 확장 시 모듈 분리 필요 | Low |
