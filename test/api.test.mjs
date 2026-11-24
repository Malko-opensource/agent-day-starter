// 서버 API 테스트. 실행: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';

let server;
let base;
let dir;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'assistant-'));
  server = createApp({ dbPath: path.join(dir, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

test('처음 상태는 비어 있다', async () => {
  const { status, data } = await call('GET', '/api/state');
  assert.equal(status, 200);
  assert.deepEqual(data, { tasks: [], notes: [], activity: [] });
});

test('할 일을 추가하고, 완료하고, 지운다', async () => {
  const created = await call('POST', '/api/tasks', { title: '  주간보고 초안  ', due: '2026-12-01' });
  assert.equal(created.status, 201);
  assert.equal(created.data.title, '주간보고 초안');
  assert.equal(created.data.due, '2026-12-01');
  assert.equal(created.data.done, false);

  const done = await call('PATCH', `/api/tasks/${created.data.id}`, { done: true });
  assert.equal(done.data.done, true);

  const removed = await call('DELETE', `/api/tasks/${created.data.id}`);
  assert.equal(removed.status, 204);
  const state = await call('GET', '/api/state');
  assert.equal(state.data.tasks.length, 0);
});

test('잘못된 입력은 400 으로 거절한다', async () => {
  assert.equal((await call('POST', '/api/tasks', { title: '   ' })).status, 400);
  assert.equal((await call('POST', '/api/tasks', { title: '회의', due: '내일' })).status, 400);
  assert.equal((await call('POST', '/api/notes', {})).status, 400);
});

test('없는 할 일은 404', async () => {
  assert.equal((await call('PATCH', '/api/tasks/없는-id', { done: true })).status, 404);
});

test('메모와 활동 기록이 파일에 남는다', async () => {
  await call('POST', '/api/notes', { text: '점심 이후 캐시 확인' });
  await call('POST', '/api/activity', { actor: 'agent', tool: 'add_note', summary: '메모 추가' });
  const saved = JSON.parse(await readFile(path.join(dir, 'db.json'), 'utf8'));
  assert.equal(saved.notes.at(-1).text, '점심 이후 캐시 확인');
  assert.equal(saved.activity.at(-1).actor, 'agent');
});

test('public 폴더 밖의 파일은 내주지 않는다', async () => {
  const res = await fetch(base + '/..%2Fserver.js');
  assert.notEqual(res.status, 200);
});
