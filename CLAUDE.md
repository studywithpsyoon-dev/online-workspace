# Project Instructions

## 문서 관리 규칙

### CHANGELOG.md

모든 코드 변경 작업 완료 후 `CHANGELOG.md`에 항목을 추가한다.

형식:
```
## [YYYY-MM-DD]

### Added / Changed / Fixed / Removed
- 변경 내용 요약 (관련 파일명 포함)
```

### ARCHITECTURE.md

코드베이스의 구조나 설계가 변경되면 반드시 업데이트한다:
- 파일/디렉토리 추가/삭제/이동
- Tech Stack 변경 (라이브러리, 서비스 추가/교체)
- Data Model 스키마 변경
- Component 구조 변경
- Security Rules 변경
- Deployment 방식 변경

### USE-CASES.md

기능 흐름이 변경되거나 새 기능이 추가되면 반드시 업데이트한다:
- 기존 use case의 흐름 변경
- 새로운 use case 추가
- 외부 서비스 연동 방식 변경
