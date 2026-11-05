import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';

// Public read-only endpoint; authenticated writes use the separate admin endpoint.
export default async (request: Request) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  }
  const path = new URL(request.url).pathname;
  const filename = path.startsWith('/api/fruit-images/') ? path.slice('/api/fruit-images/'.length) : undefined;
  const validFilename = /^(0[1-9]|1[01])\.(png|jpg|jpeg|webp)$/;
  if (filename && !validFilename.test(filename)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const store = getStore({ name: 'fruit-images', consistency: 'strong' });
    if (!filename) {
      const { blobs } = await store.list();
      const available = blobs.filter(blob => validFilename.test(blob.key));
      const images = [];
      for (let level = 1; level <= 11; level++) {
        const prefix = `${String(level).padStart(2, '0')}.`;
        // Keep one file per level. A deterministic order also handles duplicate extensions.
        const match = available.filter(blob => blob.key.startsWith(prefix)).sort((a, b) => a.key.localeCompare(b.key))[0];
        if (match) images.push({ level, url: `/api/fruit-images/${match.key}?v=${encodeURIComponent(match.etag)}` });
      }
      return Response.json({ images }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const data = await store.get(filename, { type: 'arrayBuffer' });
    if (!data) return new Response('Not found', { status: 404 });
    if (data.byteLength > 5 * 1024 * 1024) return new Response('Image too large', { status: 413 });
    const bytes = new Uint8Array(data);
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const text = new TextDecoder('ascii');
    const webp = text.decode(bytes.slice(0, 4)) === 'RIFF' && text.decode(bytes.slice(8, 12)) === 'WEBP';
    const contentType = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
    if (!contentType) return new Response('Unsupported image', { status: 415 });
    return new Response(new Blob([data]).stream(), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ error: 'Images temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
};

export const config: Config = { path: ['/api/fruit-images', '/api/fruit-images/:filename'] };
