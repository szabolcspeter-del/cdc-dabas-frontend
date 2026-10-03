const ORIGIN = 'https://www.dabasingatlan.hu';

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
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
  const descriptive = (type && city) ? `${type}-${city}` : (title || city || type || 'ingatlan');
  return `${code}-${descriptive}`.replace(/-+/g, '-');
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const slug = cleanText(req.query?.slug || '').replace(/^\/+|\/+$/g, '');
    if (!slug) return res.status(400).send('Missing property slug');

    const records = await getPublishedProperties();
    const record = records.find(r => propertySlug(r.fields || {}, r.id) === slug);
    if (!record) return res.status(404).send('Property not found');

    const photos = Array.isArray(record.fields?.['Fotók'])
      ? record.fields['Fotók'].map(x => x?.url || x?.thumbnails?.large?.url).filter(Boolean)
      : [];
    const imageUrl = photos[0];
    if (!imageUrl) return res.status(404).send('Property image not found');

    const imageResponse = await fetch(imageUrl, {
      headers: { 'User-Agent': 'CDC-Dabas-Facebook-Image-Proxy/1.0' }
    });
    if (!imageResponse.ok) return res.status(imageResponse.status).send('Image fetch failed');

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(415).send('Unsupported image type');
    }

    const body = await imageResponse.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(Buffer.from(body));
  } catch (error) {
    console.error('Property image proxy failed:', error);
    return res.status(500).send('Internal server error');
  }
}
