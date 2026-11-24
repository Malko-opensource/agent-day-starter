// 에이전트가 쓰는 도구 모음.
// 규칙: 기능 하나 = 화면 + 도구. 화면에 기능을 붙이면 여기에 짝이 되는 도구도 붙인다.
//
// 등록 경로는 두 가지다.
//  1) WebMCP: document.modelContext.registerTool (Chrome의 표준안 구현)
//  2) 예비 경로: window.assistantTools.list() / .call(name, input)
//     WebMCP가 꺼진 브라우저에서도 같은 도구를 스크립트로 부를 수 있다.
import * as store from './store.js';

const ACTOR = 'agent';

function findTask(id) {
  const task = store.getState().tasks.find((t) => t.id === id);
  if (!task) throw new Error(`id가 ${id} 인 할 일이 없습니다. list_tasks 로 id를 먼저 확인하세요.`);
  return task;
}

export const tools = [
  {
    name: 'get_briefing',
    description: '오늘 브리핑을 돌려준다. 남은 할 일 수, 오늘 기한인 일, 기한이 지난 일, 가장 최근 메모가 들어 있다. 하루를 시작하거나 현재 상황을 물을 때 먼저 부른다.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async execute() {
      await store.refresh();
      return store.briefing();
    },
  },
  {
    name: 'list_tasks',
    description: '할 일 목록을 돌려준다. 각 항목에 id, title, due(YYYY-MM-DD 또는 null), done 이 있다. 완료 처리나 삭제 전에 id를 확인하려고 부른다.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'done', 'all'], description: '가져올 범위. 기본값은 open.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async execute({ status = 'open' } = {}) {
      const { tasks } = await store.refresh();
      if (status === 'all') return tasks;
      return tasks.filter((t) => (status === 'done' ? t.done : !t.done));
    },
  },
  {
    name: 'add_task',
    description: '할 일을 하나 추가한다. 화면의 할 일 목록에 바로 나타난다.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200, description: '할 일 내용.' },
        due: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: '기한. YYYY-MM-DD. 없으면 생략.' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    async execute({ title, due }) {
      return store.addTask({ title, due: due || null }, ACTOR, 'add_task');
    },
  },
  {
    name: 'complete_task',
    description: '할 일을 완료 처리한다. id는 list_tasks 에서 얻는다.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '할 일 id.' } },
      required: ['id'],
      additionalProperties: false,
    },
    async execute({ id }) {
      await store.refresh();
      findTask(id);
      return store.setTaskDone(id, true, ACTOR, 'complete_task');
    },
  },
  {
    name: 'add_note',
    description: '메모를 하나 남긴다. 화면의 메모 목록에 바로 나타난다.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', minLength: 1, maxLength: 2000, description: '메모 내용.' } },
      required: ['text'],
      additionalProperties: false,
    },
    async execute({ text }) {
      return store.addNote({ text }, ACTOR, 'add_note');
    },
  },
  {
    name: 'list_notes',
    description: '메모 목록을 최신순으로 돌려준다.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100, description: '가져올 개수. 기본값은 20.' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async execute({ limit = 20 } = {}) {
      const { notes } = await store.refresh();
      return notes.slice(-limit).reverse();
    },
  },
];

// 예비 경로. 실패도 값으로 돌려줘서 부르는 쪽이 이유를 읽을 수 있게 한다.
window.assistantTools = {
  list() {
    return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  },
  async call(name, input = {}) {
    const tool = tools.find((t) => t.name === name);
    if (!tool) return { ok: false, error: `${name} 라는 도구가 없습니다. list() 로 이름을 확인하세요.` };
    try {
      return { ok: true, result: await tool.execute(input) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
};

// WebMCP 등록. 결과를 돌려줘서 화면이 현재 경로를 표시할 수 있게 한다.
export async function registerWebMcp() {
  const mc = document.modelContext;
  if (!mc || typeof mc.registerTool !== 'function') {
    return { webmcp: false, registered: 0, reason: '이 브라우저에는 document.modelContext 가 없습니다.' };
  }
  let registered = 0;
  const failures = [];
  for (const tool of tools) {
    try {
      await mc.registerTool({
        ...tool,
        // 던진 오류는 브라우저가 "Tool execution failed" 로 뭉개서 전달한다.
        // 에이전트가 이유를 읽고 고칠 수 있게 오류를 값으로 돌려준다.
        async execute(input, options) {
          try {
            return await tool.execute(input ?? {}, options);
          } catch (err) {
            return { error: err.message };
          }
        },
      });
      registered += 1;
    } catch (err) {
      failures.push(`${tool.name}: ${err.message}`);
    }
  }
  return { webmcp: registered > 0, registered, reason: failures.join('; ') || null };
}
