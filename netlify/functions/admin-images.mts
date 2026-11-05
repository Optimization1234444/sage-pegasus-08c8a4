import { getUser } from '@netlify/identity';
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';

export default async (request: Request) => {
  const reply = (data: object, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  const user = await getUser();
  if (!user) return reply({ error: '请先登录管理员账号。' }, 401);
  if (!user.roles?.includes('admin')) return reply({ error: '仅管理员可以管理图片。' }, 403);
  if (!['PUT', 'DELETE'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'PUT, DELETE' } });
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: '请求来源无效。' }, 403);
  const level = new URL(request.url).searchParams.get('level') || '';
  if (!/^(?:[1-9]|10|11)$/.test(level)) return reply({ error: '无效的水果等级。' }, 400);
  try {
    const prefix = `${level.padStart(2, '0')}.`;
    const store = getStore({ name: 'fruit-images', consistency: 'strong' });
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    if (request.method === 'DELETE') {
      await Promise.all(extensions.map(ext => store.delete(prefix + ext)));
      return reply({ ok: true });
    }
    const data = await request.arrayBuffer();
    if (!data.byteLength || data.byteLength > 4 * 1024 * 1024) return reply({ error: '图片不能为空，且不能超过 4 MB。' }, 413);
    const bytes = new Uint8Array(data);
    const png = [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const text = new TextDecoder('ascii');
    const webp = text.decode(bytes.slice(0,4)) === 'RIFF' && text.decode(bytes.slice(8,12)) === 'WEBP';
    const ext = png ? 'png' : jpeg ? 'jpg' : webp ? 'webp' : null;
    if (!ext) return reply({ error: '仅支持 PNG、JPG 和 WebP 图片。' }, 415);
    await store.set(prefix + ext, data);
    await Promise.all(extensions.filter(other => other !== ext).map(other => store.delete(prefix + other)));
    return reply({ ok: true });
  } catch { return reply({ error: '保存失败，请稍后重试。' }, 503); }
};
export const config: Config = { path: '/api/admin/images' };
