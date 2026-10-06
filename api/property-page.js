const ORIGIN = 'https://www.dabasingatlan.hu';

function getLang(req) {
  const q = String(req.query?.lang || '').toLowerCase();
  if (q === 'en' || q === 'de') return q;
  const candidates = [req.url, req.headers?.['x-forwarded-uri'], req.headers?.['x-vercel-original-url']].filter(Boolean).join(' ');
  const m = candidates.match(/\/(en|de)(?:\/|$)/i);
  return (m?.[1] || 'hu').toLowerCase();
}

const LANG_TEXT = {
  hu: { dealSale:'Eladó', dealRent:'Kiadó', fallback:'Eladó és kiadó ingatlanok Dabas és környékén.', titleSuffix:'CDC Dabas Ingatlaniroda', home:'Főoldal', properties:'Ingatlanok' },
  en: { dealSale:'For sale', dealRent:'For rent', fallback:'Properties for sale and rent in Dabas and the surrounding area.', titleSuffix:'CDC Dabas Real Estate', home:'Home', properties:'Properties' },
  de: { dealSale:'Zu verkaufen', dealRent:'Zu vermieten', fallback:'Immobilien zum Verkauf und zur Miete in Dabas und Umgebung.', titleSuffix:'CDC Dabas Immobilien', home:'Startseite', properties:'Immobilien' }
};

function localizedDeal(value, lang) {
  if (lang === 'en') return value === 'Eladó' ? 'For sale' : value === 'Kiadó' ? 'For rent' : value;
  if (lang === 'de') return value === 'Eladó' ? 'Zu verkaufen' : value === 'Kiadó' ? 'Zu vermieten' : value;
  return value;
}

function localizedType(value, lang) {
  const maps = { en: {Ház:'House',Lakás:'Apartment',Telek:'Plot',Iroda:'Office',Üzlethelyiség:'Commercial unit',Garázs:'Garage',Mezőgazdasági:'Agricultural',Ipari:'Industrial',Egyéb:'Other'}, de: {Ház:'Haus',Lakás:'Wohnung',Telek:'Grundstück',Iroda:'Büro',Üzlethelyiség:'Gewerbeeinheit',Garázs:'Garage',Mezőgazdasági:'Landwirtschaftlich',Ipari:'Gewerbe/Industrie',Egyéb:'Sonstige'} };
  return maps[lang]?.[value] || value;
}

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
    descriptionEn: cleanText(f['Leírás EN'] || ''),
    descriptionDe: cleanText(f['Leírás DE'] || ''),
    photos,
    photo: photos[0] || null,
  };
}

function formatPrice(price) {
  if (!price) return '';
  return new Intl.NumberFormat('hu-HU').format(price);
}

function makeTitle(p, lang = 'hu') {
  const tx = LANG_TEXT[lang] || LANG_TEXT.hu;
  const deal = localizedDeal(p.deal || 'Ingatlan', lang);
  const type = localizedType(p.type || p.title || 'Immobilie', lang);
  const city = p.city || 'Dabas';
  return `${deal} ${type} ${city} | ${tx.titleSuffix}`;
}

function makeDescription(p, lang = 'hu') {
  const fallbackParts = [
    p.deal ? `${p.deal} ${p.type || 'ingatlan'}` : (p.type || 'Ingatlan'),
    p.city ? `${p.city} területén` : 'Dabas és környékén',
    p.price ? `${formatPrice(p.price)} Ft` : '',
    p.area ? `${p.area} m²` : ''
  ].filter(Boolean).join(' · ');

  const localized = lang === 'en' ? p.descriptionEn : lang === 'de' ? p.descriptionDe : p.description;
  return truncate(localized || p.description || fallbackParts || LANG_TEXT[lang].fallback, 200);
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

  return records.filter(record => {
    const f = record.fields || {};
    return String(f['Ingatlan státusza'] || '').trim().toLowerCase() === 'aktív'
      && f['Publikálva a weboldalon'] === true;
  });
}

function getRequestedSlug(req) {
  const fromQuery = cleanText(req.query?.slug || '').replace(/^\/+|\/+$/g, '');
  if (fromQuery) return decodeURIComponent(fromQuery);

  // Vercel can expose the original path in different request properties.
  const candidates = [
    req.url,
    req.headers?.['x-forwarded-uri'],
    req.headers?.['x-vercel-original-url'],
    req.headers?.['x-invoke-path']
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = String(candidate).match(/\/ingatlan\/([^/?#]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return '';
}

function findProperty(records, slug) {
  const normalized = slugify(slug);
  if (!normalized) return null;

  // 1. Exact match with the exact same slug algorithm used by the frontend.
  let record = records.find(r => propertySlug(r.fields || {}, r.id) === normalized);
  if (record) return record;

  // 2. More tolerant fallback: compare the code prefix and the descriptive suffix.
  // This protects the Facebook renderer if Airtable contains a number/string formatting
  // difference in the code field while the public URL remains unchanged.
  const dash = normalized.indexOf('-');
  const codePart = dash > 0 ? normalized.slice(0, dash) : normalized;
  const descriptivePart = dash > 0 ? normalized.slice(dash + 1) : '';

  record = records.find(r => {
    const f = r.fields || {};
    const codes = [f['Ingatlan kód'], f['Ingatlan ID'], r.id]
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
      .map(slugify);
    if (!codes.includes(codePart)) return false;

    const type = slugify(f['Ingatlantípus'] || '');
    const city = slugify(f['Település'] || '');
    const title = slugify(f['Cím'] || '');
    const suffixes = [
      type && city ? `${type}-${city}` : '',
      title || '',
      city || '',
      type || ''
    ].filter(Boolean);
    return !descriptivePart || suffixes.some(s => s === descriptivePart || s.endsWith(`-${descriptivePart}`));
  });

  return record || null;
}

async function getIndexTemplate() {
  const response = await fetch(`${ORIGIN}/index.html?seo_template=1`, {
    headers: { 'User-Agent': 'CDC-Dabas-SEO-Renderer/2.0' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Could not load index.html (${response.status})`);
  return response.text();
}

function injectMeta(html, p, url, slug, lang = 'hu') {
  const title = makeTitle(p, lang);
  const description = makeDescription(p, lang);
  const prefix = lang === 'hu' ? '' : `/${lang}`;
  const image = p.photo
    ? `${ORIGIN}/ingatlan-kepek/${encodeURIComponent(slug)}.jpg`
    : `${ORIGIN}/icon-512.png`;
  const localizedUrl = `${ORIGIN}${prefix}/ingatlan/${encodeURIComponent(slug)}`;

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

  const canonical = `<link rel="canonical" href="${escHtml(localizedUrl)}">`;
  result = result.replace(/<link\s+rel="canonical"[^>]*>/i, canonical);
  if (!/<link\s+rel="canonical"[^>]*>/i.test(result)) result = result.replace(/<\/head>/i, `${canonical}\n</head>`);
  result = result.replace(/<link\s+rel="alternate"[^>]*>/gi, '');
  const baseSlug = encodeURIComponent(slug);
  const hreflangs = [['hu', `${ORIGIN}/ingatlan/${baseSlug}`], ['en', `${ORIGIN}/en/ingatlan/${baseSlug}`], ['de', `${ORIGIN}/de/ingatlan/${baseSlug}`], ['x-default', `${ORIGIN}/ingatlan/${baseSlug}`]].map(([l,u]) => `<link rel="alternate" hreflang="${l}" href="${escHtml(u)}">`).join('\n');
  result = result.replace(/<\/head>/i, `${hreflangs}\n</head>`);
  result = result.replace(/<html([^>]*)>/i, (m, attrs) => `<html${attrs.replace(/\slang=\"[^\"]*\"/i,'')} lang="${lang}">`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `${localizedUrl}#listing`,
    name: title,
    url: localizedUrl,
    description,
    image: p.photo ? [`${ORIGIN}/ingatlan-kepek/${encodeURIComponent(slug)}.jpg`] : [],
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

  const breadcrumbName = cleanText(`${localizedDeal(p.deal || 'Ingatlan', lang)} ${localizedType(p.type || p.title || 'Immobilie', lang)} ${p.city || ''}`);
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: (LANG_TEXT[lang] || LANG_TEXT.hu).home, item: `${ORIGIN}${lang === 'hu' ? '/' : `/${lang}/`}` },
      { '@type': 'ListItem', position: 2, name: (LANG_TEXT[lang] || LANG_TEXT.hu).properties, item: `${ORIGIN}${lang === 'hu' ? '/' : `/${lang}/`}#ingatlanok` },
      { '@type': 'ListItem', position: 3, name: breadcrumbName, item: localizedUrl }
    ]
  };

  const schemaTag = `<script type="application/ld+json" id="propertySchema">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [jsonLd, breadcrumb] }).replace(/</g, '\\u003c')}</script>`;
  result = result.replace(/<script\s+type="application\/ld\+json"\s+id="propertySchema">[\s\S]*?<\/script>/i, schemaTag);
  if (!/id="propertySchema"/.test(result)) result = result.replace(/<\/head>/i, `${schemaTag}\n</head>`);

  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const lang = getLang(req);
    const slug = getRequestedSlug(req);
    if (!slug) return res.status(400).send('Missing property slug');

    const records = await getPublishedProperties();
    const record = findProperty(records, slug);
    if (!record) return res.status(404).send('Property not found');

    const p = mapProperty(record);
    const canonicalSlug = propertySlug(record.fields || {}, record.id);
    const url = `${ORIGIN}${lang === 'hu' ? '' : `/${lang}`}/ingatlan/${encodeURIComponent(canonicalSlug)}`;
    const template = await getIndexTemplate();
    const html = injectMeta(template, p, url, canonicalSlug, lang);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'index, follow');
    // Do not let an old generic homepage HTML response get stuck in a CDN cache.
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Property page rendering failed:', error);
    return res.status(500).send('Internal server error');
  }
}
