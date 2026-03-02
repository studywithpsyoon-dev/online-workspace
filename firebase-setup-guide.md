# Firebase 설정 가이드

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. **"프로젝트 추가"** 클릭
3. 프로젝트 이름 입력 (예: `online-workplace`)
4. Google Analytics는 끄셔도 됩니다 → **"프로젝트 만들기"**

## 2. 웹 앱 등록

1. 프로젝트 대시보드에서 **웹 아이콘 `</>`** 클릭
2. 앱 닉네임 입력 (예: `workplace-web`)
3. **Firebase Hosting은 체크하지 않아도 됩니다** (Vercel로 배포할 거예요)
4. **"앱 등록"** 클릭
5. 화면에 나오는 `firebaseConfig` 값을 복사해 두세요:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "online-workplace-xxxxx.firebaseapp.com",
  databaseURL: "https://online-workplace-xxxxx-default-rtdb.firebaseio.com",
  projectId: "online-workplace-xxxxx",
  storageBucket: "online-workplace-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
```

## 3. Realtime Database 활성화

1. 왼쪽 메뉴에서 **"빌드" → "Realtime Database"** 클릭
2. **"데이터베이스 만들기"** 클릭
3. 위치: **미국 (us-central1)** 또는 아시아 선택
4. 보안 규칙: **"테스트 모드에서 시작"** 선택 → **"사용 설정"**

## 4. 보안 규칙 설정

테스트 모드는 30일 후 만료됩니다. 아래 규칙으로 교체해 주세요:

1. Realtime Database → **"규칙"** 탭 클릭
2. 아래 내용으로 교체 후 **"게시"**:

```json
{
  "rules": {
    "workspace": {
      "currentMembers": {
        ".read": true,
        ".write": true
      },
      "log": {
        ".read": false,
        ".write": true
      }
    }
  }
}
```

> **설명**: 누구나 현재 접속자를 볼 수 있고, 입퇴실 기록을 남길 수 있습니다.
> 로그는 쓰기만 가능하고 읽기는 불가합니다 (관리자만 Firebase 콘솔에서 확인).

## 5. index.html에 설정값 입력

`index.html`을 열어서 상단의 `FIREBASE_CONFIG` 부분을 찾아 값을 교체합니다:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "여기에_apiKey",
  authDomain:        "여기에_authDomain",
  databaseURL:       "여기에_databaseURL",    // ← 이 값이 꼭 있어야 합니다!
  projectId:         "여기에_projectId",
  storageBucket:     "여기에_storageBucket",
  messagingSenderId: "여기에_messagingSenderId",
  appId:             "여기에_appId"
};
```

> **중요**: `databaseURL`이 비어있거나 누락되면 실시간 기능이 작동하지 않습니다.
> Firebase 콘솔 → Realtime Database 페이지 상단에서 URL을 확인할 수 있습니다.

## 6. 구글 캘린더 링크 (선택)

구글 캘린더 초대장 링크가 있다면, `CALENDAR_LINK`에도 넣어주세요:

```javascript
const CALENDAR_LINK = "https://calendar.google.com/...";
```

## 7. 완료!

브라우저에서 `index.html`을 열면 바로 확인할 수 있습니다.
Firebase가 정상적으로 연결되면 노란색 안내 배너가 사라지고, 입퇴실 기능이 활성화됩니다.

---

## 추가 참고

- **무료 플랜(Spark)** 으로 충분합니다 (동시 접속 100명, 월 1GB 전송)
- 데이터 삭제: Firebase 콘솔 → Realtime Database에서 직접 삭제 가능
- 문제 발생 시 브라우저 개발자 도구(F12) → Console 탭에서 에러 메시지 확인
