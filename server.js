// 개인비서 로컬 서버. 의존성 없음. 실행: node server.js
// 화면(public/)을 내려주고, 할 일·메모·활동 기록을 data/db.json 에 저장한다.
// 이 서버는 LLM을 호출하지 않는다. 판단은 클로드 코드 세션이 한다.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const MAX_BODY = 64 * 1024;
const MAX_ACTIVITY = 500;

function emptyState() {
  return { tasks: [], notes: [], activity: [] };
}

export function createApp({ dbPath = path.join(ROOT, 'data', 'db.json') } = {}) {
  let state = null;
  let writing = Promise.resolve();

  async function load() {
    if (state) return state;
    try {
      state = { ...emptyState(), ...JSON.parse(await readFile(dbPath, 'utf8')) };
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      state = emptyState();
    }
    return state;
  }

  function save() {
    // 쓰기를 한 줄로 세워 동시에 온 요청이 파일을 덮어쓰지 않게 한다.
    writing = writing.then(async () => {
      await mkdir(path.dirname(dbPath), { recursive: true });
      await writeFile(dbPath, JSON.stringify(state, null, 2));
    });
    return writing;
  }

  function send(res, status, body) {
    const text = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
    res.end(text);
  }

  async function readJson(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw Object.assign(new Error('요청 본문이 너무 큽니다.'), { status: 413 });
      chunks.push(chunk);
    }
    if (!chunks.length) return {};
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch {
      throw Object.assign(new Error('본문은 JSON 객체여야 합니다.'), { status: 400 });
    }
  }

  function cleanText(value, field, max) {
    if (typeof value !== 'string' || !value.trim()) {
      throw Object.assign(new Error(`${field} 값이 비어 있습니다.`), { status: 400 });
    }
    return value.trim().slice(0, max);
  }

  function cleanDue(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw Object.assign(new Error('due 는 YYYY-MM-DD 형식이어야 합니다.'), { status: 400 });
    }
    return value;
  }

  async function api(req, res, url) {
    const s = await load();
    const parts = url.pathname.split('/').filter(Boolean); // ['api', 'tasks', ':id']
    const [, resource, id] = parts;

    if (req.method === 'GET' && resource === 'state' && !id) return send(res, 200, s);

    if (resource === 'tasks') {
      if (req.method === 'POST' && !id) {
        const body = await readJson(req);
        const task = {
          id: randomUUID(),
          title: cleanText(body.title, 'title', 200),
          due: cleanDue(body.due),
          done: false,
          createdAt: new Date().toISOString(),
        };
        s.tasks.push(task);
        await save();
        return send(res, 201, task);
      }
      const task = s.tasks.find((t) => t.id === id);
      if (id && !task) return send(res, 404, { error: '그런 할 일이 없습니다.' });
      if (req.method === 'PATCH' && task) {
        const body = await readJson(req);
        if ('title' in body) task.title = cleanText(body.title, 'title', 200);
        if ('due' in body) task.due = cleanDue(body.due);
        if ('done' in body) task.done = Boolean(body.done);
        await save();
        return send(res, 200, task);
      }
      if (req.method === 'DELETE' && task) {
        s.tasks = s.tasks.filter((t) => t.id !== id);
        await save();
        return send(res, 204);
      }
    }

    if (resource === 'notes' && req.method === 'POST' && !id) {
      const body = await readJson(req);
      const note = { id: randomUUID(), text: cleanText(body.text, 'text', 2000), createdAt: new Date().toISOString() };
      s.notes.push(note);
      await save();
      return send(res, 201, note);
    }

    if (resource === 'activity' && req.method === 'POST' && !id) {
      const body = await readJson(req);
      const entry = {
        id: randomUUID(),
        at: new Date().toISOString(),
        actor: body.actor === 'agent' ? 'agent' : 'human',
        tool: typeof body.tool === 'string' ? body.tool.slice(0, 80) : null,
        summary: cleanText(body.summary, 'summary', 300),
      };
      s.activity.push(entry);
      if (s.activity.length > MAX_ACTIVITY) s.activity = s.activity.slice(-MAX_ACTIVITY);
      await save();
      return send(res, 201, entry);
    }

    return send(res, 404, { error: '없는 경로입니다.' });
  }

  async function staticFile(res, url) {
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(PUBLIC_DIR, rel);
    // public 폴더 밖으로 나가는 경로는 거절한다.
    if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('찾을 수 없습니다.');
    }
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else if (req.method === 'GET') await staticFile(res, url);
      else res.writeHead(405).end();
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      send(res, status, { error: err.message || '서버 오류' });
    }
  });
}

// 직접 실행했을 때만 서버를 띄운다. 테스트는 createApp 을 가져다 쓴다.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4321;
  createApp({ dbPath: process.env.ASSISTANT_DB || undefined }).listen(port, '127.0.0.1', () => {
    console.log(`개인비서가 떴습니다: http://localhost:${port}`);
    console.log('끄려면 Ctrl+C');
  });
}
