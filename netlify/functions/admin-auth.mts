import { getUser, login, logout, acceptInvite, recoverPassword, requestPasswordRecovery } from '@netlify/identity';
import type { Config } from '@netlify/functions';

export default async (request: Request) => {
  const reply = (data: object, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method === 'GET') {
    const user = await getUser();
    return reply({ admin: !!user?.roles?.includes('admin') }, user ? (user.roles?.includes('admin') ? 200 : 403) : 401);
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: '请求来源无效。' }, 403);
  try {
    const data = await request.json();
    if (data.action === 'logout') { await logout(); return reply({ ok: true }); }
    if (data.action === 'recovery') {
      await requestPasswordRecovery(String(data.email || ''));
      return reply({ message: '如果该邮箱已注册，重置密码邮件已发送。' });
    }
    if (typeof data.password !== 'string' || !data.password) return reply({ error: '请输入密码。' }, 400);
    const user = data.action === 'invite'
      ? await acceptInvite(String(data.token || ''), data.password)
      : data.action === 'reset'
        ? await recoverPassword(String(data.token || ''), data.password)
        : data.action === 'login'
          ? await login(String(data.email || ''), data.password)
          : null;
    if (!user) return reply({ error: '无效操作。' }, 400);
    if (!user.roles?.includes('admin')) { await logout(); return reply({ error: '该账号没有管理员权限，请联系站点所有者分配 admin 角色。' }, 403); }
    return reply({ ok: true });
  } catch {
    return reply({ error: '操作失败，请检查邮箱、密码或邮件链接后重试。' }, 400);
  }
};
export const config: Config = { path: '/api/admin/auth' };
