// 금지 조건 테스트: 이 앱은 LLM을 호출하지 않는다.
// 판단은 클로드 코드 세션이 하고, 앱은 화면과 도구만 제공한다.
// 누군가(사람이든 에이전트든) 앱에 LLM 호출을 넣으면 이 테스트가 실패한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['server.js', 'public'];
const FORBIDDEN = [
  /api\.anthropic\.com/i,
  /api\.openai\.com/i,
  /generativelanguage\.googleapis\.com/i,
  /openrouter\.ai/i,
  /ANTHROPIC_API_KEY/,
  /OPENAI_API_KEY/,
  /GEMINI_API_KEY/,
  /from ['"]@anthropic-ai\/sdk['"]/,
  /from ['"]openai['"]/,
  /\/v1\/(messages|chat\/completions)/,
];

async function collect(target) {
  const full = path.join(ROOT, target);
  const entries = await readdir(full, { withFileTypes: true }).catch(() => null);
  if (!entries) return [full];
  const nested = await Promise.all(entries.map((e) => collect(path.join(target, e.name))));
  return nested.flat();
}

test('앱 코드에 LLM 호출이나 API 키가 없다', async () => {
  const files = (await Promise.all(SCAN.map(collect))).flat().filter((f) => /\.(js|mjs|html)$/.test(f));
  assert.ok(files.length > 0, '검사할 파일을 찾지 못했습니다.');
  const hits = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) hits.push(`${path.relative(ROOT, file)} 에서 ${pattern} 발견`);
    }
  }
  assert.deepEqual(hits, [], '앱은 LLM을 호출하면 안 됩니다. 판단은 클로드 코드 세션이 합니다.');
});
