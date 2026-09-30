export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRigFAlvCv';
  const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'Ingatlanok';

  if (!token) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN is not configured' });
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100&filterByFormula=${encodeURIComponent('AND({Ingatlan státusza}="Aktív",{Publikálva a weboldalon}=1)')}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Airtable request failed' });
    }

    const records = data.records || [];
    const pick = (fields, names) => {
      for (const name of names) {
        if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') return fields[name];
      }
      return null;
    };

    const properties = records.map(record => {
      const f = record.fields || {};
      const photos = pick(f, ['Fotók', 'Fotok', 'Képek', 'Képek / Fotók']);
      return {
        id: record.id,
        ingatlanId: pick(f, ['Ingatlan ID', 'IngatlanID']),
        title: pick(f, ['Cím', 'Megnevezés']) || 'Ingatlan',
        city: pick(f, ['Település', 'Város']) || '',
        type: pick(f, ['Ingatlantípus', 'Típus']) || '',
        deal: pick(f, ['Eladó / Kiadó', 'Ügylet']) || '',
        price: Number(pick(f, ['Ár', 'Ar']) || 0),
        area: Number(pick(f, ['Négyzetméter', 'Alapterület']) || 0),
        lot: Number(pick(f, ['Telekméret', 'Telekméret (m²)']) || 0),
        rooms: Number(pick(f, ['Szobák száma', 'Szobák']) || 0) || null,
        bathrooms: Number(pick(f, ['Fürdőszobák száma', 'Fürdőszobák']) || 0) || null,
        description: pick(f, ['Leírás', 'Leiras']) || '',
        map: pick(f, ['Helyszín / térkép', 'Helyszín', 'Térkép']) || '',
        featured: Boolean(pick(f, ['Kiemelt ingatlan', 'Kiemelt'])),
        photos: Array.isArray(photos) ? photos.map(x => x.url).filter(Boolean) : []
      };
    });

    return res.status(200).json({ properties });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
