# 나의 개인비서

내 PC에서 도는 개인비서 웹서비스다. 클로드 코드 세션이 두뇌이고, 이 웹은 화면과 도구를 제공하는 손발이다.

## 지켜야 할 규칙

1. **이 앱은 LLM을 호출하지 않는다.** API 키, LLM SDK, 챗봇 엔드포인트를 넣지 않는다. 요약·분류·판단이 필요하면 클로드 코드 세션이 도구로 자료를 읽고 직접 한다. `test/no-llm.test.mjs` 가 이 규칙을 검사한다. 이 테스트 파일은 고치지 않는다.
2. **기능 하나 = 화면 + 도구.** 화면에 기능을 붙이면 `public/tools.js` 에 짝이 되는 도구를 같이 붙인다. 도구는 `public/store.js` 의 같은 함수를 불러서, 에이전트가 도구를 쓰면 화면이 사람이 누른 것처럼 바뀌어야 한다.
3. **에이전트가 한 일은 활동 기록에 남긴다.** 도구에서 store 동작을 부를 때 actor 를 `'agent'` 로, tool 에 도구 이름을 넘긴다.
4. **의존성을 늘리지 않는다.** `node server.js` 한 줄로 떠야 한다. 패키지 설치가 꼭 필요하면 먼저 묻는다.
5. **끝났다고 말하기 전에 확인한다.** `npm test` 를 통과시키고, 띄운 화면에서 새 기능을 도구로 한 번 실행해 본다.

## 실행

- 띄우기: `node server.js` → http://localhost:4321
- 테스트: `npm test`
- 환경 점검: `npm run check`

## 구조

- `server.js`: 화면 파일 제공, `/api/*` 로 할 일·메모·활동 기록 저장 (`data/db.json`)
- `public/store.js`: 상태와 동작. 화면과 도구가 함께 쓴다
- `public/app.js`: 화면 그리기와 폼 처리
- `public/tools.js`: 에이전트용 도구 정의, WebMCP 등록(`document.modelContext`), 예비 경로(`window.assistantTools`)
- `.claude/skills/assistant/`: 클로드가 이 비서를 쓰는 방법
- `test/`: API 테스트와 금지 조건 테스트

## 도구를 쓰는 길

이 프로젝트의 `.mcp.json` 이 Chrome DevTools MCP 를 WebMCP 옵션과 함께 띄운다. 자세한 순서는 `assistant` 스킬에 있다.
