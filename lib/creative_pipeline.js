/**
 * 生图 / 改图统一流水线：支持多引擎与降级
 * provider: auto | jimeng | meitu
 * action: generate | edit
 */
const jimeng = require('./jimeng_cli');
const meitu = require('./meitu_cli');

function runMeituGenerate(prompt) {
  if (!meitu.hasCredentials() && !meitu.cliAvailable()) {
    return {
      ok: false,
      error: '美图未配置 MEITU_OPENAPI_ACCESS_KEY/SECRET_KEY 或未安装 meitu-cli',
      engine: 'meitu',
    };
  }
  return meitu.imageGenerate(prompt);
}

function runMeituEdit(imageRef, prompt) {
  if (!meitu.hasCredentials() && !meitu.cliAvailable()) {
    return { ok: false, error: '美图 CLI/密钥未就绪', engine: 'meitu' };
  }
  return meitu.imageEdit(imageRef, prompt);
}

function runJimengGenerate(prompt) {
  return jimeng.generateImage(prompt);
}

/**
 * @param {object} p
 * @param {'generate'|'edit'} p.action
 * @param {string} p.prompt
 * @param {string} [p.imageUrl] 改图时：URL 或本地路径（服务端可访问）
 * @param {'auto'|'jimeng'|'meitu'} [p.provider]
 */
function runImage(p) {
  const action = p.action || 'generate';
  const provider = p.provider || 'auto';
  const prompt = (p.prompt || '').trim();
  const imageRef = p.imageUrl || p.image || '';

  if (action === 'edit') {
    if (!imageRef) {
      return { ok: false, error: '改图需要 imageUrl（图片地址或路径）', code: 'NEED_IMAGE' };
    }
    if (provider === 'jimeng') {
      return {
        ok: false,
        error: '当前即梦 CLI 封装未实现改图，请改用美图或 auto',
        code: 'JIMENG_NO_EDIT',
      };
    }
    if (provider === 'meitu') {
      const m = runMeituEdit(imageRef, prompt);
      return { ...m, action: 'edit' };
    }
    // auto: 美图改图
    return { ...runMeituEdit(imageRef, prompt), action: 'edit', provider: 'meitu' };
  }

  // generate
  if (provider === 'meitu') {
    const m = runMeituGenerate(prompt);
    return { ...m, action: 'generate' };
  }
  if (provider === 'jimeng') {
    const j = runJimengGenerate(prompt);
    return { ...j, action: 'generate' };
  }

  // auto: 先即梦，失败则美图
  const j = runJimengGenerate(prompt);
  if (j.ok) return { ...j, action: 'generate', provider: 'jimeng' };

  const m = runMeituGenerate(prompt);
  if (m.ok) {
    return {
      ...m,
      action: 'generate',
      provider: 'meitu',
      fallbackFrom: 'jimeng',
      jimengError: j.error || j.raw,
    };
  }
  return {
    ok: false,
    error: `即梦失败: ${j.error || j.raw}; 美图失败: ${m.error || m.raw}`,
    jimengError: j,
    meituError: m,
    action: 'generate',
  };
}

module.exports = { runImage, runMeituGenerate, runJimengGenerate };
