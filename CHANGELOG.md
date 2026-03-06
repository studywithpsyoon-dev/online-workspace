# Changelog

## [2026-03-06]

### Added
- `ARCHITECTURE.md` — 코드베이스 구조 및 설계 문서
- `USE-CASES.md` — 주요 기능 흐름 문서
- `CLAUDE.md` — 프로젝트 작업 지침
- `CHANGELOG.md` — 변경 이력 추적

### Fixed
- `currentMembers`에 `uid` 필드 추가, 세션 복원 시 `displayName` 대신 `uid`로 매칭 (app.js)
- Firebase Security Rules에서 `log`의 읽기 권한을 `false` → `auth !== null`로 수정 (firebase-setup-guide.md)
