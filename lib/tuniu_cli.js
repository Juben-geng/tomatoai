/**
 * 途牛 tuniu-cli 统一调用（MCP JSON 输出）
 * 需: npm i -g tuniu-cli@latest 且配置 TUNIU_API_KEY
 * 文档: https://open.tuniu.com/mcp/docs/apidoc/cli/cliTools.html
 */
const { spawnSync } = require('child_process');

function findJsonObjectStart(s) {
  const i = s.indexOf('{');
  return i >= 0 ? i : 0;
}

/**
 * @param {string} server hotel|flight|train|ticket|cruise|holiday
 * @param {string} tool 工具名
 * @param {object} argsObj JSON 参数对象
 * @param {object} [options]
 * @returns {{ ok: boolean, data?: object, error?: string, raw?: string }}
 */
function callTuniuCli(server, tool, argsObj, options = {}) {
  const apiKey = options.apiKey || process.env.TUNIU_API_KEY;
  if (!apiKey) {
    return { ok: false, error: '未设置环境变量 TUNIU_API_KEY', raw: '' };
  }

  const argsJson = JSON.stringify(argsObj);
  const bin = options.tuniuBin || 'tuniu';

  const result = spawnSync(
    bin,
    ['call', server, tool, '-a', argsJson, '-o', 'json'],
    {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, TUNIU_API_KEY: apiKey },
      timeout: options.timeout || 90000,
      windowsHide: true,
      shell: false,
    }
  );

  const stderr = (result.stderr || '').trim();
  const stdout = (result.stdout || '').trim();

  if (result.error) {
    return { ok: false, error: result.error.message, raw: stdout || stderr };
  }

  const out = stdout || stderr;
  if (!out) {
    return { ok: false, error: 'tuniu CLI 无输出，请确认已安装: npm i -g tuniu-cli@latest', raw: '' };
  }

  let parsed;
  try {
    parsed = JSON.parse(out.substring(findJsonObjectStart(out)));
  } catch (e) {
    return { ok: false, error: `解析 CLI JSON 失败: ${e.message}`, raw: out.substring(0, 2000) };
  }

  if (!parsed.success) {
    const msg = parsed.error?.message || parsed.message || 'MCP 返回失败';
    return { ok: false, error: msg, raw: out.substring(0, 2000), parsed };
  }

  const text = parsed.result?.content?.[0]?.text;
  if (text == null || text === '') {
    return { ok: false, error: 'MCP 结果无 content[0].text', raw: out.substring(0, 2000) };
  }

  let inner;
  try {
    inner = typeof text === 'string' ? JSON.parse(text) : text;
  } catch (e) {
    return { ok: false, error: `解析内层 JSON 失败: ${e.message}`, text: String(text).slice(0, 500) };
  }

  return { ok: true, data: inner, raw: out };
}

module.exports = { callTuniuCli };
