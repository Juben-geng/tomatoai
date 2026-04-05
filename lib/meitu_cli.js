/**
 * 美图 MiracleVision OpenAPI — meitu-cli
 * npm install -g meitu-cli
 * 环境变量: MEITU_OPENAPI_ACCESS_KEY, MEITU_OPENAPI_SECRET_KEY
 * 文档: https://github.com/meitu/meitu-cli
 */
const { spawnSync } = require('child_process');

function resolveBin() {
  return process.env.MEITU_BIN || 'meitu';
}

function run(args) {
  const bin = resolveBin();
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env },
    timeout: 300000,
    shell: process.platform === 'win32',
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.error) return { ok: false, error: r.error.message, raw: out, engine: 'meitu' };
  if (r.status !== 0) return { ok: false, error: out || `exit ${r.status}`, raw: out, engine: 'meitu', code: 'EXIT' };
  return { ok: true, raw: out, engine: 'meitu' };
}

/** 文生图 */
function imageGenerate(prompt) {
  return run(['image-generate', '--prompt', prompt, '--json']);
}

/**
 * 图生编辑 — 支持本地路径或 URL
 * meitu image-edit --image <path|url> --prompt "..." --json
 */
function imageEdit(imageRef, prompt) {
  if (!imageRef || !prompt) {
    return { ok: false, error: '缺少 image 或 prompt', engine: 'meitu' };
  }
  return run(['image-edit', '--image', imageRef, '--prompt', prompt, '--json']);
}

function authVerify() {
  return run(['auth', 'verify', '--json']);
}

function cliAvailable() {
  const bin = resolveBin();
  const r = spawnSync(bin, ['--help'], { encoding: 'utf8', timeout: 8000, shell: true });
  return (r.status === 0 || `${r.stdout || ''}${r.stderr || ''}`.length > 10);
}

function hasCredentials() {
  return !!(process.env.MEITU_OPENAPI_ACCESS_KEY && process.env.MEITU_OPENAPI_SECRET_KEY);
}

module.exports = {
  imageGenerate,
  imageEdit,
  authVerify,
  cliAvailable,
  hasCredentials,
  resolveBin,
};
