// 상태와 동작을 한곳에 둔다. 화면(app.js)과 도구(tools.js)가 같은 함수를 쓴다.
// 그래서 에이전트가 도구를 부르면 사람이 버튼을 누른 것과 똑같이 화면이 바뀐다.

let state = { tasks: [], notes: [], activity: [] };
const listeners = new Set();

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function emit() {
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export async function refresh() {
  state = await request('GET', '/api/state');
  emit();
  return state;
}

// actor: 'human' (화면에서 직접) 또는 'agent' (도구 호출)
async function log(actor, tool, summary) {
  const entry = await request('POST', '/api/activity', { actor, tool, summary });
  state.activity.push(entry);
}

export function todayString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function addTask({ title, due = null }, actor = 'human', tool = null) {
  const task = await request('POST', '/api/tasks', { title, due });
  state.tasks.push(task);
  await log(actor, tool, `할 일 추가: ${task.title}`);
  emit();
  return task;
}

export async function setTaskDone(id, done, actor = 'human', tool = null) {
  const task = await request('PATCH', `/api/tasks/${encodeURIComponent(id)}`, { done });
  state.tasks = state.tasks.map((t) => (t.id === id ? task : t));
  await log(actor, tool, `${done ? '완료 처리' : '완료 취소'}: ${task.title}`);
  emit();
  return task;
}

export async function removeTask(id, actor = 'human', tool = null) {
  const task = state.tasks.find((t) => t.id === id);
  await request('DELETE', `/api/tasks/${encodeURIComponent(id)}`);
  state.tasks = state.tasks.filter((t) => t.id !== id);
  await log(actor, tool, `할 일 삭제: ${task ? task.title : id}`);
  emit();
}

export async function addNote({ text }, actor = 'human', tool = null) {
  const note = await request('POST', '/api/notes', { text });
  state.notes.push(note);
  await log(actor, tool, `메모 추가: ${note.text.slice(0, 40)}`);
  emit();
  return note;
}

export function briefing() {
  const today = todayString();
  const open = state.tasks.filter((t) => !t.done);
  return {
    date: today,
    openCount: open.length,
    doneCount: state.tasks.length - open.length,
    dueToday: open.filter((t) => t.due === today),
    overdue: open.filter((t) => t.due && t.due < today),
    latestNote: state.notes.at(-1) || null,
  };
}
