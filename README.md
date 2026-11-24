# 나의 개인비서 (출발점)

"에이전트와 함께하는 하루" 실습의 출발점입니다. 모두 이 폴더에서 시작해 각자의 비서로 키웁니다.

## 5분 안에 띄우기

1. 이 폴더에서 터미널을 엽니다.
2. `.mcp.json` 과 `.claude/skills/assistant/SKILL.md` 가 없다면 `setup/` 에서 옮깁니다.
   - `setup/mcp.json.example` → `.mcp.json`
   - `setup/skills/assistant/SKILL.md` → `.claude/skills/assistant/SKILL.md`
3. `npm run check` 로 환경을 점검합니다.
4. `node server.js` 로 비서를 띄웁니다.
5. 새 터미널에서 `claude` 를 실행하고, 처음 뜨는 MCP 서버 승인 질문에 동의합니다.
6. 클로드에게 말합니다: "비서에 '주간보고 초안' 할 일을 추가하고 오늘 브리핑 알려 줘."

화면의 활동 기록에 "에이전트 (add_task)" 가 찍히면 성공입니다.

## 지금 들어 있는 것

- 화면 네 칸: 오늘 브리핑, 할 일, 메모, 활동 기록
- 에이전트용 도구 6개: `get_briefing`, `list_tasks`, `add_task`, `complete_task`, `add_note`, `list_notes`
- 테스트 7개: API 동작 6개, "앱은 LLM을 호출하지 않는다" 1개

디자인은 일부러 비워 두었습니다. 오전 실습에서 각자 입힙니다.

## 도구가 안 보일 때

- 화면 맨 위 상태 문구를 봅니다. "WebMCP 꺼짐" 이면 브라우저가 WebMCP 없이 뜬 것입니다.
- 그래도 실습은 됩니다. 클로드가 예비 경로(`window.assistantTools`)로 같은 도구를 부릅니다.
- Windows 에서 MCP 서버가 뜨지 않으면 `.mcp.json` 의 `"command": "npx"` 를 `"command": "cmd"` 로 바꾸고 `args` 맨 앞에 `"/c", "npx"` 를 넣어 보세요.

## 규칙

`CLAUDE.md` 에 다섯 가지 규칙이 있습니다. 가장 중요한 두 가지는 이렇습니다.

- 이 앱은 LLM을 호출하지 않는다.
- 기능 하나 = 화면 + 도구.
