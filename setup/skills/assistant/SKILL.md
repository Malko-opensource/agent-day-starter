---
name: assistant
description: 내 개인비서 웹(http://localhost:4321)을 도구로 조작한다. 할 일이나 메모를 추가·조회·완료해 달라고 하거나, 오늘 브리핑이나 현재 상황을 물을 때 쓴다.
---

# 개인비서 쓰기

개인비서는 로컬 웹서비스다. 화면을 클릭하지 말고 페이지가 내놓은 도구를 부른다.

## 순서

1. 비서가 떠 있는지 확인한다. 안 떠 있으면 프로젝트 폴더에서 `node server.js` 를 백그라운드로 띄운다.
2. Chrome DevTools MCP 로 `http://localhost:4321` 페이지를 연다. 이미 열려 있으면 그 탭을 쓴다.
3. `list_webmcp_tools` 로 도구 목록을 받는다.
4. `execute_webmcp_tool` 로 필요한 도구를 부른다.
5. 결과를 사용자에게 한두 문장으로 알린다. 도구가 돌려준 값을 근거로 말하고, 돌려받지 않은 내용은 지어내지 않는다.

## 도구 목록이 비어 있을 때

WebMCP 가 꺼진 브라우저다. 같은 도구를 예비 경로로 부른다. `evaluate_script` 로 다음을 실행한다.

- 목록: `window.assistantTools.list()`
- 호출: `await window.assistantTools.call('add_task', { title: '주간보고 초안' })`

예비 경로는 `{ ok, result }` 또는 `{ ok: false, error }` 를 돌려준다. 사용자에게는 WebMCP 가 꺼져 있어 예비 경로를 썼다고 한 줄로 알린다.

## 브라우저를 열지 못할 때

`list_pages`, `new_page` 같은 Chrome DevTools MCP 도구가 오류를 내면 다른 길로 돌아가지 않는다. Node 로 `public/tools.js` 를 직접 돌리거나 서버 API 를 직접 불러 데이터를 바꾸지 않는다. 그러면 결과는 나와도 사용자가 확인하려던 경로를 거치지 않는다.

오류 메시지를 그대로 사용자에게 보여 주고 멈춘다. `The browser is already running` 이면 다른 클로드 세션이 같은 Chrome 프로필을 쓰는 중이다. `.mcp.json` 의 `args` 에 `--isolated` 가 있는지 확인해 보라고 함께 알린다.

## 쓰는 요령

- 상황을 물으면 `get_briefing` 부터 부른다.
- 완료 처리 전에는 `list_tasks` 로 id 를 확인한다. 제목이 비슷한 일이 여럿이면 어느 것인지 묻는다.
- 날짜는 `YYYY-MM-DD` 로 넘긴다. "내일", "금요일" 같은 말은 오늘 날짜 기준으로 바꿔서 넘긴다.
- 도구가 `{ error }` 를 돌려주면 메시지를 읽고 입력을 고쳐 한 번 더 시도한다. 그래도 안 되면 멈추고 사용자에게 알린다.
- 요약·분류·우선순위 판단은 도구로 읽어 온 자료를 가지고 직접 한다. 앱에 그런 기능을 요청하지 않는다.
