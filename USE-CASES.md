# Use Cases — 24hr Online Workplace

## 1. Google 인증

```
사용자 → 로그인 버튼 클릭
       → auth.signInWithPopup(googleProvider)
          ├── 성공 → onAuthStateChanged → user 상태 설정
          └── 실패 (popup 차단 등)
               → auth.signInWithRedirect(googleProvider)
                  → 페이지 리로드 후 getRedirectResult()로 결과 수신
```

인증 상태는 Firebase SDK가 IndexedDB로 자체 관리. 새로고침 시 `onAuthStateChanged`로 자동 복원.

---

## 2. 입실

1. `workspace/currentMembers`에 `push()` — `{ uid, nickname, photoURL, enteredAt }`
2. `onDisconnect().remove()` 등록 — 비정상 종료 대비 자동 정리
3. `workspace/log`에 퇴실 로그 `onDisconnect().set()` 예약
4. `workspace/log`에 입실 로그 `push()`
5. `sessionStorage`에 입실 데이터 저장 (새로고침 복원용)
6. Jitsi 화상회의 자동 연결

---

## 3. 퇴실

1. 예약된 `onDisconnect` 취소 (`cancel()`)
2. `workspace/currentMembers/{key}` 삭제
3. `workspace/log`에 퇴실 로그 `push()`
4. `sessionStorage` 제거
5. Jitsi API `dispose()`

---

## 4. 비정상 종료 (브라우저 닫기, 네트워크 끊김)

Firebase `onDisconnect` 메커니즘이 서버 사이드에서 처리:
1. `currentMembers/{key}` 자동 삭제
2. `log`에 퇴실 기록 자동 기록 (`ServerValue.TIMESTAMP` 사용)

---

## 5. 세션 복원

두 가지 경로로 입실 상태를 복원:

### 5-1. 같은 브라우저 새로고침 (sessionStorage)

```
sessionStorage에 checkInData 존재
→ Firebase에 새 currentMembers 항목 push (uid 포함)
→ 이전 autoExitKey의 예약 퇴실 로그 삭제
→ 새 onDisconnect 등록
```

### 5-2. 다른 기기에서 로그인 (Firebase 조회)

```
sessionStorage 비어있음
→ workspace/currentMembers 전체 조회
→ user.uid와 일치하는 항목 검색
→ 있으면 해당 상태로 복원
```

---

## 6. 실시간 동기화

두 개의 Firebase `.on('value')` 리스너:

| 리스너 | 경로 | 역할 |
|--------|------|------|
| Members | `workspace/currentMembers` | 접속자 목록 갱신. 내 항목 삭제 감지 시 자동 퇴실 처리 |
| Logs | `workspace/log` (limitToLast 100) | 입퇴실 기록 표시 |

### 로그 정리 정책

- **7일 초과 삭제**: 클라이언트가 로그를 읽을 때 오래된 항목 자동 삭제
- **중복 제거**: 같은 사용자의 동일 액션이 60초 이내 중복 시 UI에서 필터링

---

## 7. 화상회의 (Jitsi/JaaS)

```
JitsiMeetExternalAPI("8x8.vc", {
  roomName: `${JAAS_APP_ID}/${JITSI_ROOM}`,
  parentNode: jitsiContainerRef.current,
  ...config
})
```

- **JaaS (8x8.vc)** — meet.jit.si 임베드 시간 제한 우회를 위해 전환
- 고정 룸: `24hr-online-workplace-cpk-2026`
- 기본 설정: 마이크/카메라 음소거 입장, 로비 비활성화, 녹화/라이브스트리밍/자막 비활성화
- 툴바: microphone, camera, chat, raisehand, tileview, hangup, settings, select-background
- API 로딩 대기: `JitsiMeetExternalAPI`가 `undefined`이면 300ms 간격 재시도 (async 스크립트)
- 접기/펼치기: `display: none`으로 숨기되 연결은 유지
- 퇴실 시 `dispose()`로 정리
