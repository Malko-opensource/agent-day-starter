// 실습 환경 점검. 실행: npm run check
// Node, 클로드 코드, Chrome 버전과 포트를 확인하고 한 줄씩 결과를 알려준다.
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import { existsSync } from 'node:fs';

const MIN_NODE = 20;
const MIN_CHROME = 150;
const PORT = Number(process.env.PORT) || 4321;
const results = [];

function report(ok, name, detail) {
  results.push(ok);
  console.log(`${ok ? '[통과]' : '[확인 필요]'} ${name}: ${detail}`);
}

function run(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim();
  } catch {
    return null;
  }
}

// Node
const nodeMajor = Number(process.versions.node.split('.')[0]);
report(nodeMajor >= MIN_NODE, 'Node.js', `v${process.versions.node} (필요: ${MIN_NODE} 이상)`);

// 클로드 코드
const claude = process.platform === 'win32' ? run('cmd', ['/c', 'claude', '--version']) : run('claude', ['--version']);
report(Boolean(claude), '클로드 코드', claude || '`claude` 명령을 찾지 못했습니다. 설치 후 새 터미널에서 다시 실행하세요.');

// Chrome
function chromeVersion() {
  if (process.platform === 'win32') {
    for (const hive of ['HKCU', 'HKLM']) {
      const out = run('reg', ['query', `${hive}\\Software\\Google\\Chrome\\BLBeacon`, '/v', 'version']);
      const match = out && out.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) return match[1];
    }
    return null;
  }
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const bin of candidates) {
    if (bin.startsWith('/') && !existsSync(bin)) continue;
    const match = (run(bin, ['--version']) || '').match(/(\d+\.\d+\.\d+\.\d+)/);
    if (match) return match[1];
  }
  return null;
}
const chrome = chromeVersion();
if (!chrome) {
  report(false, 'Chrome', '버전을 읽지 못했습니다. 주소창에 chrome://version 을 넣어 직접 확인하세요.');
} else {
  const major = Number(chrome.split('.')[0]);
  report(major >= MIN_CHROME, 'Chrome', `${chrome} (WebMCP 실습: ${MIN_CHROME} 이상)`);
}

// 포트
const free = await new Promise((resolve) => {
  const probe = net.createServer();
  probe.once('error', () => resolve(false));
  probe.once('listening', () => probe.close(() => resolve(true)));
  probe.listen(PORT, '127.0.0.1');
});
report(free, `포트 ${PORT}`, free ? '비어 있음' : '이미 사용 중입니다. 비서가 떠 있는 것이 아니라면 PORT=4322 node server.js 처럼 바꿔 띄우세요.');

console.log('');
console.log(results.every(Boolean)
  ? '모두 통과했습니다. node server.js 로 비서를 띄우세요.'
  : '[확인 필요] 항목을 먼저 해결하세요. WebMCP 가 안 되더라도 예비 경로로 실습은 계속할 수 있습니다.');
