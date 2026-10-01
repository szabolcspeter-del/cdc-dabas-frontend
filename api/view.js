export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRligFAIvCv';
  const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'tblNJ5etsbiMWAnMZ';
  const { propertyId, unique } = req.body || {};

  if (!token) return res.status(500).json({ error: 'AIRTABLE_TOKEN is not configured' });
  if (!propertyId || typeof propertyId !== 'string') return res.status(400).json({ error: 'Hiányzó ingatlan azonosító.' });

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const recordUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${encodeURIComponent(propertyId)}`;

  try {
    // Validate that the record is actually a published, active property before allowing a counter update.
    const recordResponse = await fetch(recordUrl, { headers: { Authorization: `Bearer ${token}` } });
    const recordData = await recordResponse.json();
    if (!recordResponse.ok) return res.status(recordResponse.status).json({ error: 'Az ingatlan nem található.' });

    const fields = recordData.fields || {};
    const active = String(fields['Ingatlan státusza'] || '').trim().toLowerCase() === 'aktív';
    const published = fields['Publikálva a weboldalon'] === true;
    if (!active || !published) return res.status(404).json({ error: 'Az ingatlan nem elérhető.' });

    const views = Number(fields['Megtekintések'] || 0);
    const uniqueViews = Number(fields['Egyedi megtekintések'] || 0);
    const nextViews = views + 1;
    const nextUniqueViews = unique === true ? uniqueViews + 1 : uniqueViews;

    const updateResponse = await fetch(recordUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          'Megtekintések': nextViews,
          ...(unique === true ? { 'Egyedi megtekintések': nextUniqueViews } : {})
        }
      })
    });
    const updateData = await updateResponse.json();
    if (!updateResponse.ok) {
      return res.status(updateResponse.status).json({ error: 'A megtekintés mentése nem sikerült.', detail: updateData?.error?.message || null });
    }

    return res.status(200).json({ ok: true, views: nextViews, uniqueViews: nextUniqueViews });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
