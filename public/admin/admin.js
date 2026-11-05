'use strict';
const $ = selector => document.querySelector(selector);
const names = ['第1级图标','第2级图标','第3级图标','第4级图标','第5级图标','第6级图标','第7级图标','第8级图标','第9级图标','第10级图标','第11级图标'];
const params = new URLSearchParams(location.hash.slice(1));
let invite = params.get('invite_token');
let recovery = params.get('recovery_token');
if (invite || recovery) {
  history.replaceState(null, '', location.pathname);
  $('#login-title').textContent = invite ? '设置管理员密码' : '设置新密码';
  $('#email-label').hidden = true;
  $('#email').required = false;
  $('#password').autocomplete = 'new-password';
  $('#password').minLength = 8;
  $('#submit').textContent = '保存密码并登录';
  $('#forgot').hidden = true;
}
function message(text) { $('#message').textContent = text; }
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) { $('#manager').hidden = true; $('#login-panel').hidden = false; }
    throw new Error(data.error || '暂时无法完成操作，请重试。');
  }
  return data;
}
async function auth(data) {
  return api('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
async function render() {
  $('#grid').textContent = '';
  const { images } = await api('/api/fruit-images');
  names.forEach((name, index) => {
    const level = index + 1;
    const image = images.find(entry => entry.level === level);
    const card = document.createElement('article');
    card.className = 'fruit-card';
    card.innerHTML = `<h3><span class="level">${String(level).padStart(2,'0')}</span>${name}</h3><div class="preview"></div><label>替换图片<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传${name}图片"></label><button class="restore" type="button">恢复默认图片</button>`;
    const preview = card.querySelector('.preview');
    {
      const img = new Image(); img.alt = name; img.src = image ? image.url : index === 0 ? '/assets/fruits/grape.png' : index === 10 ? '/assets/fruits/0.png' : index === 9 ? '/assets/fruits/12.png' : `/assets/fruits/${index}.png`;
      img.onerror = () => { preview.textContent = '图片暂不可用，请重新上传'; };
      preview.append(img);

    }
    const input = card.querySelector('input');
    const restore = card.querySelector('button');
    restore.disabled = !image;
    async function change(method, file) {
      input.disabled = true; restore.disabled = true;
      try {
        message(method === 'PUT' ? `正在上传${name}…` : `正在恢复${name}…`);
        await api(`/api/admin/images?level=${level}`, { method, ...(file ? { headers: { 'Content-Type': file.type }, body: file } : {}) });
        await render();
        message(`${name}已${method === 'PUT' ? '更新' : '恢复默认'}，刷新游戏即可查看。`);
      } catch (error) { message(error.message); }
      finally { input.disabled = false; restore.disabled = !image; input.value = ''; }
    }
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024 || !file.size) { message('请选择不超过 4 MB 的 PNG、JPG 或 WebP 图片。'); input.value = ''; return; }
      const url = URL.createObjectURL(file);
      try { const img = new Image(); img.src = url; await img.decode(); }
      catch { message('图片无法打开，请换一张有效图片。'); input.value = ''; return; }
      finally { URL.revokeObjectURL(url); }
      await change('PUT', file);
    });
    restore.addEventListener('click', () => { if (window.confirm(`恢复${name}的默认图片？当前自定义图片将被删除。`)) change('DELETE'); });
    $('#grid').append(card);
  });
}
async function showManager() {
  await api('/api/admin/auth');
  $('#login-panel').hidden = true; $('#manager').hidden = false;
  await render();
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#submit').disabled = true; message('正在验证管理员身份…');
  try {
    await auth({ action: invite ? 'invite' : recovery ? 'reset' : 'login', email: $('#email').value, password: $('#password').value, token: invite || recovery });
    invite = null; recovery = null; $('#password').value = '';
    await showManager(); message('已登录，选择要替换的图标图片。');
  } catch (error) { message(error.message); }
  finally { $('#submit').disabled = false; }
});
$('#forgot').addEventListener('click', async () => {
  if (!$('#email').reportValidity() || !$('#email').value) return;
  $('#forgot').disabled = true;
  try { const result = await auth({ action: 'recovery', email: $('#email').value }); message(result.message); }
  catch (error) { message(error.message); }
  finally { $('#forgot').disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  try { await auth({ action: 'logout' }); location.replace('/admin/'); }
  catch (error) { message(error.message); }
});
if (!invite && !recovery) showManager().catch(error => {
  if (error.message.includes('暂时')) message('请使用管理员账号登录。'); else message(error.message);
});
