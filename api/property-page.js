const ORIGIN = 'https://www.dabasingatlan.hu';

function escHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncate(value = '', max = 200) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+$/, '')}…`;
}

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' es ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function propertySlug(f, recordId) {
  const code = slugify(f['Ingatlan kód'] || f['Ingatlan ID'] || recordId);
  const type = slugify(f['Ingatlantípus'] || '');
  const city = slugify(f['Település'] || '');
  const title = slugify(f['Cím'] || '');
  const descriptive = (type && city)
    ? `${type}-${city}`
    : (title || city || type || 'ingatlan');
  return `${code}-${descriptive}`.replace(/-+/g, '-');
}

function mapProperty(record) {
  const f = record.fields || {};
  const photos = Array.isArray(f['Fotók'])
    ? f['Fotók'].map(x => x?.url || x?.thumbnails?.large?.url).filter(Boolean)
    : [];

  return {
    recordId: record.id,
    title: cleanText(f['Cím'] || ''),
    city: cleanText(f['Település'] || ''),
    type: cleanText(f['Ingatlantípus'] || ''),
    deal: cleanText(f['Eladó / Kiadó'] || ''),
    price: Number(f['Ár'] || 0),
    area: Number(f['Alapterület'] ?? f['Négyzetméter'] ?? f['Alapterület (m²)'] ?? 0),
    description: cleanText(f['Leírás'] || ''),
    photos,
    photo: photos[0] || null,
  };
}

function formatPrice(price) {
  if (!price) return '';
  return new Intl.NumberFormat('hu-HU').format(price);
}

function makeTitle(p) {
  const deal = p.deal || 'Ingatlan';
  const type = p.type || p.title || 'ingatlan';
  const city = p.city || 'Dabas és környéke';
  return `${deal} ${type} ${city} | CDC Dabas Ingatlaniroda`;
}

function makeDescription(p) {
  const fallbackParts = [
    p.deal ? `${p.deal} ${p.type || 'ingatlan'}` : (p.type || 'Ingatlan'),
    p.city ? `${p.city} területén` : 'Dabas és környékén',
    p.price ? `${formatPrice(p.price)} Ft` : '',
    p.area ? `${p.area} m²` : ''
  ].filter(Boolean).join(' · ');

  return truncate(p.description || fallbackParts || 'Eladó és kiadó ingatlanok Dabas és környékén.', 200);
}

async function getPublishedProperties() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRligFAIvCv';
  const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'tblNJ5etsbiMWAnMZ';
  if (!token) throw new Error('AIRTABLE_TOKEN is not configured');

  const records = [];
  let offset = '';
  do {
    const qs = new URLSearchParams({ pageSize: '100' });
    if (offset) qs.set('offset', offset);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?${qs.toString()}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Airtable request failed');
    records.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);

  return records
    .filter(record => {
      const f = record.fields || {};
      return String(f['Ingatlan státusza'] || '').trim().toLowerCase() === 'aktív'
        && f['Publikálva a weboldalon'] === true;
    });
}

async function getIndexTemplate() {
  const response = await fetch(`${ORIGIN}/index.html`, {
    headers: { 'User-Agent': 'CDC-Dabas-SEO-Renderer/1.0' }
  });
  if (!response.ok) throw new Error(`Could not load index.html (${response.status})`);
  return response.text();
}

function injectMeta(html, p, url) {
  const title = makeTitle(p);
  const description = makeDescription(p);
  const image = p.photo || `${ORIGIN}/icon-512.png`;

  const replacements = [
    [/<title>[^<]*<\/title>/i, `<title>${escHtml(title)}</title>`],
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escHtml(description)}">`],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escHtml(title)}">`],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${escHtml(description)}">`],
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${escHtml(url)}">`],
    [/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${escHtml(image)}">`],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${escHtml(title)}">`],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${escHtml(description)}">`],
    [/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${escHtml(image)}">`],
  ];

  let result = html;
  for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);

  const canonical = `<link rel="canonical" href="${escHtml(url)}">`;
  result = result.replace(/<link\s+rel="canonical"[^>]*>/i, canonical);
  if (!/<link\s+rel="canonical"[^>]*>/i.test(result)) {
    result = result.replace(/<\/head>/i, `${canonical}\n</head>`);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `${url}#listing`,
    name: title,
    url,
    description,
    image: p.photos || [],
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    offers: {
      '@type': 'Offer',
      price: p.price || 0,
      priceCurrency: 'HUF',
      availability: 'https://schema.org/InStock'
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: p.city || 'Dabas',
      addressCountry: 'HU'
    }
  };
  if (p.deal === 'Kiadó') {
    jsonLd.offers.priceSpecification = {
      '@type': 'UnitPriceSpecification',
      price: p.price || 0,
      priceCurrency: 'HUF',
      unitCode: 'MON'
    };
  }

  const breadcrumbName = cleanText(`${p.deal || 'Ingatlan'} ${p.type || p.title || 'Ingatlan'} ${p.city || ''}`);
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Főoldal', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Ingatlanok', item: `${ORIGIN}/#ingatlanok` },
      { '@type': 'ListItem', position: 3, name: breadcrumbName, item: url }
    ]
  };

  const schemaTag = `<script type="application/ld+json" id="propertySchema">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [jsonLd, breadcrumb] }).replace(/</g, '\\u003c')}</script>`;
  result = result.replace(/<script\s+type="application\/ld\+json"\s+id="propertySchema">[\s\S]*?<\/script>/i, schemaTag);
  if (!/id="propertySchema"/.test(result)) {
    result = result.replace(/<\/head>/i, `${schemaTag}\n</head>`);
  }

  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const slug = cleanText(req.query?.slug || '').replace(/^\/+|\/+$/g, '');
    if (!slug) return res.status(400).send('Missing property slug');

    const records = await getPublishedProperties();
    const record = records.find(r => propertySlug(r.fields || {}, r.id) === slug);
    if (!record) return res.status(404).send('Property not found');

    const p = mapProperty(record);
    const url = `${ORIGIN}/ingatlan/${encodeURIComponent(propertySlug(record.fields || {}, record.id))}`;
    const template = await getIndexTemplate();
    const html = injectMeta(template, p, url);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Property page rendering failed:', error);
    return res.status(500).send('Internal server error');
  }
}
