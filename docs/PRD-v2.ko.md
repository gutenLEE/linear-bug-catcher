> 🌐 [English](PRD-v2.en.md) · **한국어**

# [PRD v2] Linear 연동 버그 리포팅 크롬 익스텐션 (MVP)

리뷰 반영 최종본. v1 대비 변경점은 각 항목에 표기.

## 1. 개요

- **제품명:** Linear Bug Catcher
- **목적:** QA/테스트 중 발견한 버그를 브라우저 이탈 없이 화면 캡처 + 네트워크 로그와 함께
  Linear 티켓으로 즉시 생성한다.
- **타겟:** 사내 QA, 기획자, 프론트/백엔드 개발자
- **대상 브라우저:** Chromium 계열(Chrome, Edge)만

## 2. 확정된 핵심 설계 결정

| # | 항목 | 결정 |
|---|---|---|
| 1 | 네트워크 수집 | **Fetch/XHR 오버라이드** (MAIN world, `document_start`). `webRequest`/`devtools.network` 미사용 |
| 2 | 수집 시점 | 페이지 로드부터 **상시 rolling buffer**. 팝업/모달은 조회만. 버퍼 크기 **탭당 20개** |
| 3 | 캡처 필터 | **Allowlist glob 패턴**, **전체 URL 기준** 매칭. 매칭된 요청만 버퍼에 저장 → Datadog RUM 등 자동 제외 |
| 4 | 이미지 첨부 | Linear `fileUpload` → PUT → `assetUrl`을 본문 마크다운에 인라인. **자체 서버/S3 불필요** |
| 5 | 인증 | **Personal API Key만** (OAuth는 v2). `chrome.storage.local` 평문 저장 |
| 6 | 캡처 범위 | **뷰포트만** (`captureVisibleTab`). 전체 페이지/영상 제외 |
| 7 | 마스킹 | 네트워크 바디/헤더 **자동 마스킹 안 함**. 화면 민감정보는 유저가 **모자이크 툴**로 수동 처리 |
| 8 | UI 형태 | 팝업이 아닌 **페이지 주입 오버레이 모달**(shadow DOM). 설정도 모달 내 별도 화면 |

## 3. 기능 요구사항

### 3.1 인증 · 설정
- **REQ-01 (변경):** 최초 실행 시 Linear **Personal API Key**로 연동. (OAuth 제거)
- **REQ-02 (변경):** 연동 후 접근 가능한 **Team(필수) + Project(선택)** 목록을 불러와 기본값 설정.
  (Linear 이슈 생성에는 `teamId` 필수)
- **REQ-11 (신규):** 설정 화면에 **네트워크 캡처 경로 패턴(allowlist)** 입력. glob(`*`), 한 줄에 하나,
  전체 URL 기준. 기본값 `/api/*`, `*/graphql`.

### 3.2 캡처 · 주석
- **REQ-03:** 실행 시 활성 탭 **뷰포트** 즉시 캡처(`captureVisibleTab`).
- **REQ-04 (변경):** 주석 툴 = **사각형 실선 · 화살표 · 텍스트 · 모자이크(파괴적)**.
  모자이크는 캔버스 비트맵의 픽셀을 실제로 뭉개 원본을 파괴 → 업로드 PNG에 원본 잔존 없음.

### 3.3 네트워크 로그
- **REQ-05 (변경):** 페이지 로드 시점부터 fetch/XHR을 가로채 **allowlist 매칭 요청만** rolling buffer(20)에 저장.
  매칭 안 되는 요청(텔레메트리 포함)은 수집 제외. 캡처 시 Datadog/OTel 트레이싱 헤더는 자동 제거.
- **REQ-06:** 티켓 화면에서 버퍼를 리스트로 노출. **4xx/5xx는 상단 하이라이트**.
- **REQ-07:** 유저가 첨부할 요청을 **체크박스로 선택**(Request/Response Body 포함).
- **REQ-08 (완화):** 바디/헤더 자동 마스킹 없음. 민감정보는 화면 모자이크로 대응.

### 3.4 Linear 이슈 생성
- **REQ-09:** 제목(Title) + 설명(Problem / Requirements) 입력.
- **REQ-10 (명확화):** `issueCreate`로 이슈 생성. **본문(Description)** = `## Problem` + `## Requirements` +
  `## Screenshot` 이미지(`![](assetUrl)`) + `## Network logs` 선택 요청(json 코드블록).
  제목 → 이슈 Title, 나머지는 전부 Description 하나로 조립. 이미지는 `fileUpload` 3-스텝으로 첨부.

## 4. 사용자 플로우
1. 버그 발견 → 2. Alt+Shift+B(또는 아이콘) → 3. 뷰포트 자동 캡처 + 버퍼의 실패 요청 자동 체크 →
4. 주석/모자이크 + 요청 선택 + 제목 입력 → 5. '티켓 생성' → 6. Linear 이슈 생성 + 링크 노출.

## 5. 기술 스택
- React + TypeScript, Vite + `@crxjs/vite-plugin` (MV3)
- MAIN world content script(fetch/XHR 오버라이드), ISOLATED content script(버퍼 + shadow DOM 모달)
- Background service worker: `captureVisibleTab` + 모든 Linear 네트워크(CORS 회피)
- 아이콘: `@tabler/icons-react`(인라인 SVG, shadow DOM 호환)

## 6. 배포
- Chrome Web Store 비공개(Unlisted) 등록 후 **Google Workspace 관리 콘솔에서 조직 내 강제 설치/제한**.
  (Workspace 관리자 권한 의존)

## 7. Out of Scope / 제약
- 영상 녹화, 전체 페이지 스크롤 캡처 제외.
- WebSocket/sendBeacon 등 fetch·XHR 외 트래픽 미수집.
- Safari/Firefox 미지원.
- API 키 평문 저장(암호화·OAuth는 v2).

## 8. 보안 메모
- `chrome.storage.local`은 평문 저장 → 로컬 공격자에게 노출 가능. 관리 기기 전제.
  클라이언트 암호화는 복호화 키가 함께 노출되어 실효 없음(security theater). 최소권한은 v2 OAuth로.
