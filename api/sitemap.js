export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(405).send('<?xml version="1.0" encoding="UTF-8"?><error>Method not allowed</error>');
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRligFAIvCv';
  const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'tblNJ5etsbiMWAnMZ';
  const origin = 'https://www.dabasingatlan.hu';

  const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const slugify = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' es ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  const propertySlug = (f, recordId) => {
    const code = slugify(f['Ingatlan kód'] || f['Ingatlan ID'] || recordId);
    const type = slugify(f['Ingatlantípus'] || '');
    const city = slugify(f['Település'] || '');
    const title = slugify(f['Cím'] || '');
    const descriptive = (type && city)
      ? `${type}-${city}`
      : (title || city || type || 'ingatlan');
    return `${code}-${descriptive}`.replace(/-+/g, '-');
  };

  // Make the sitemap response unambiguously XML even through the Vercel rewrite.
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  try {
    if (!token) throw new Error('AIRTABLE_TOKEN is missing');

    const records = [];
    let offset = '';

    // Read all Airtable pages, not just the first 100 records.
    do {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (offset) qs.set('offset', offset);
      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?${qs.toString()}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Airtable error');
      records.push(...(data.records || []));
      offset = data.offset || '';
    } while (offset);

    const urls = [
      { loc: `${origin}/`, priority: '1.0', changefreq: 'daily' },
    ];

    for (const record of records) {
      const f = record.fields || {};
      const active = String(f['Ingatlan státusza'] || '').trim().toLowerCase() === 'aktív';
      const published = f['Publikálva a weboldalon'] === true;
      if (!active || !published) continue;

      const modified = f['Módosítás dátuma'];
      let lastmod = null;
      if (modified) {
        const d = new Date(modified);
        if (!Number.isNaN(d.getTime())) lastmod = d.toISOString();
      }

      urls.push({
        loc: `${origin}/ingatlan/${propertySlug(f, record.id)}`,
        lastmod,
        priority: '0.8',
        changefreq: 'weekly',
      });
    }

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls.map((u) => [
        '<url>',
        `<loc>${esc(u.loc)}</loc>`,
        u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : '',
        `<changefreq>${u.changefreq}</changefreq>`,
        `<priority>${u.priority}</priority>`,
        '</url>',
      ].join('')).join(''),
      '</urlset>',
    ].join('\n');

    return res.status(200).send(body);
  } catch (e) {
    console.error('Sitemap generation failed:', e);

    // Still return valid XML so a transient backend failure is not exposed as
    // an HTML/text error page to crawlers. The homepage remains discoverable.
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>`;
    return res.status(200).send(fallback);
  }
}
