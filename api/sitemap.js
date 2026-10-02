export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRligFAIvCv';
  const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'tblNJ5etsbiMWAnMZ';
  const origin = 'https://www.dabasingatlan.hu';
  const esc = (s='') => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const slugify = (value='') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' es ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-+/g,'-');
  const propertySlug = (f, recordId) => {
    const code = slugify(f['Ingatlan kód'] || f['Ingatlan ID'] || recordId);
    const type = slugify(f['Ingatlantípus'] || '');
    const city = slugify(f['Település'] || '');
    const title = slugify(f['Cím'] || '');
    const descriptive = (type && city) ? `${type}-${city}` : (title || city || type || 'ingatlan');
    return `${code}-${descriptive}`.replace(/-+/g,'-');
  };
  try {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Airtable error');
    const urls = [{ loc: `${origin}/`, priority: '1.0', changefreq: 'daily' }];
    for (const record of (data.records || [])) {
      const f = record.fields || {};
      const active = String(f['Ingatlan státusza'] || '').trim().toLowerCase() === 'aktív';
      const published = f['Publikálva a weboldalon'] === true;
      if (!active || !published) continue;
      const modified = f['Módosítás dátuma'];
      urls.push({ loc: `${origin}/ingatlan/${encodeURIComponent(propertySlug(f, record.id))}`, lastmod: modified ? new Date(modified).toISOString() : null, priority: '0.8', changefreq: 'weekly' });
    }
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('')}</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(body);
  } catch (e) {
    return res.status(500).send('Sitemap generation failed');
  }
}
