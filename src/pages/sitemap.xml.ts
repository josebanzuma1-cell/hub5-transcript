import type { APIRoute } from 'astro';
import { BUILT, SITE } from '../lib/site';

export const GET: APIRoute = () => {
  const today = new Date().toISOString().slice(0, 10);
  const urls: Array<{ loc: string; priority: string }> = [
    { loc: '/', priority: '1.0' },
    { loc: '/tools', priority: '0.8' },
    { loc: '/methodology', priority: '0.4' },
    { loc: '/privacy', priority: '0.2' },
    { loc: '/terms', priority: '0.2' },
    ...BUILT.map((t) => ({ loc: `/tools/${t.slug}`, priority: '0.9' })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE.url}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
