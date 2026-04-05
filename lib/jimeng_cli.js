/**
 * 即梦 / Dreamina CLI — 文生图
 * 安装: curl -s https://jimeng.jianying.com/cli | bash
 * 默认尝试: dreamina image-generate --prompt "..." --json
 * 覆盖: 设置环境变量 JIMENG_IMAGE_ARGS 为 JSON 数组，使用 __PROMPT__ 占位
 */
const { spawnSync } = require('child_process');

function resolveBin() {
  return process.env.JIMENG_BIN || process.env.DREAMINA_BIN || 'dreamina';
}

function buildArgs(prompt) {
  const raw = process.env.JIMENG_IMAGE_ARGS;
  if (raw) {
    try {
      return JSON.parse(raw).map((x) => (x === '__PROMPT__' ? prompt : x));
    } catch (e) {
      return null;
    }
  }
  return ['image-generate', '--prompt', prompt, '--json'];
}

function runJimeng(argv) {
  const bin = resolveBin();
  const r = spawnSync(bin, argv, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env },
    timeout: 300000,
    shell: process.platform === 'win32',
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.error) return { ok: false, error: r.error.message, raw: out, code: 'SPAWN' };
  if (r.status !== 0) return { ok: false, error: out || `exit ${r.status}`, raw: out, code: 'EXIT' };
  return { ok: true, raw: out };
}

function generateImage(prompt) {
  const args = buildArgs(prompt);
  if (!args) return { ok: false, error: 'JIMENG_IMAGE_ARGS 解析失败', engine: 'jimeng' };
  const r = runJimeng(args);
  return { ...r, engine: 'jimeng' };
}

function cliAvailable() {
  const bin = resolveBin();
  const r = spawnSync(bin, ['--help'], { encoding: 'utf8', timeout: 6000, shell: true });
  return (r.status === 0 || `${r.stdout || ''}${r.stderr || ''}`.length > 20);
}

module.exports = { generateImage, cliAvailable, resolveBin, buildArgs };
