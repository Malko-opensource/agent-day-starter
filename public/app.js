// 화면. store 의 상태를 그리고, 폼 입력을 store 동작으로 넘긴다.
import * as store from './store.js';
import { tools, registerWebMcp } from './tools.js';

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function renderBriefing() {
  const b = store.briefing();
  const parts = [`남은 할 일 ${b.openCount}개, 끝낸 일 ${b.doneCount}개.`];
  if (b.dueToday.length) parts.push(`오늘 기한: ${b.dueToday.map((t) => t.title).join(', ')}.`);
  if (b.overdue.length) parts.push(`기한 지남: ${b.overdue.map((t) => t.title).join(', ')}.`);
  if (b.latestNote) parts.push(`최근 메모: ${b.latestNote.text}`);
  $('briefing-text').textContent = parts.join(' ');
}

function renderTasks({ tasks }) {
  const items = tasks.map((task) => {
    const checkbox = el('input', { type: 'checkbox', checked: task.done, id: `task-${task.id}` });
    checkbox.addEventListener('change', () => run(() => store.setTaskDone(task.id, checkbox.checked)));
    const label = el('label', { htmlFor: checkbox.id, className: 'title' }, ` ${task.title}`);
    const remove = el('button', { type: 'button', textContent: '삭제' });
    remove.setAttribute('aria-label', `${task.title} 삭제`);
    remove.addEventListener('click', () => run(() => store.removeTask(task.id)));
    const li = el('li', { className: task.done ? 'done' : '' }, checkbox, label);
    if (task.due) li.append(el('span', { className: 'due', textContent: `기한 ${task.due}` }));
    li.append(el('span', { className: 'row-actions' }, remove));
    li.dataset.taskId = task.id;
    return li;
  });
  $('task-list').replaceChildren(...items);
}

function renderNotes({ notes }) {
  $('note-list').replaceChildren(...[...notes].reverse().map((n) => el('li', { textContent: n.text })));
}

function renderActivity({ activity }) {
  const items = [...activity].reverse().slice(0, 30).map((a) => {
    const who = el('span', {
      className: `actor-${a.actor}`,
      textContent: a.actor === 'agent' ? `에이전트${a.tool ? ` (${a.tool})` : ''}` : '사람',
    });
    const time = new Date(a.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return el('li', {}, `${time} `, who, ` ${a.summary}`);
  });
  $('activity-list').replaceChildren(...items);
}

async function run(action) {
  try {
    await action();
  } catch (err) {
    $('webmcp-status').textContent = `문제가 생겼습니다: ${err.message}`;
  }
}

store.subscribe((state) => {
  renderBriefing();
  renderTasks(state);
  renderNotes(state);
  renderActivity(state);
});

$('task-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  run(async () => {
    await store.addTask({ title: form.title.value, due: form.due.value || null });
    form.reset();
    form.title.focus();
  });
});

$('note-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  run(async () => {
    await store.addNote({ text: form.text.value });
    form.reset();
  });
});

await run(store.refresh);

const result = await registerWebMcp();
$('webmcp-status').textContent = result.webmcp
  ? `WebMCP 도구 ${result.registered}개 등록됨. 에이전트가 이 화면을 도구로 조작할 수 있습니다.`
  : `WebMCP 꺼짐. 예비 경로(window.assistantTools)로 도구 ${tools.length}개 사용 가능. ${result.reason || ''}`;
document.documentElement.dataset.webmcp = String(result.webmcp);
