export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRligFAIvCv';
  const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'tblNJ5etsbiMWAnMZ';

  if (!token) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN is not configured' });
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Airtable request failed',
        airtable: data?.error || null,
        message: data?.error?.message || 'Unknown Airtable error',
        status: response.status
      });
    }

    const records = data.records || [];
    const properties = records
      .filter(record => {
        const f = record.fields || {};
        const status = String(f['Ingatlan státusza'] || '').trim().toLowerCase();
        const published = f['Publikálva a weboldalon'] === true;
        return status === 'aktív' && published;
      })
      .map(record => {
        const f = record.fields || {};
        const photos = Array.isArray(f['Fotók'])
          ? f['Fotók'].map(x => x.url || x.thumbnails?.large?.url).filter(Boolean)
          : [];

        let floorplan = null;
        const rawPlan = f['Alaprajz'];
        if (Array.isArray(rawPlan) && rawPlan.length) {
          floorplan = rawPlan[0]?.url || rawPlan[0]?.thumbnails?.large?.url || null;
        } else if (rawPlan && typeof rawPlan === 'string') {
          floorplan = rawPlan;
        }

        return {
          id: record.id,
          ingatlanId: f['Ingatlan ID'] ?? null,
          title: f['Cím'] || '',
          city: f['Település'] || '',
          type: f['Ingatlantípus'] || '',
          deal: f['Eladó / Kiadó'] || '',
          price: Number(f['Ár'] || 0),
          area: Number(f['Négyzetméter'] || 0),
          lot: Number(f['Telekméret'] || 0),
          rooms: Number(f['Szobák száma'] || 0),
          bathrooms: Number(f['Fürdőszobák száma'] || 0),
          description: f['Leírás'] || '',
          photos,
          floorplan,
          map: f['Helyszín / térkép'] || '',
          featured: f['Kiemelt ingatlan'] === true
        };
      });

    return res.status(200).json({ properties, totalRecords: records.length });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
