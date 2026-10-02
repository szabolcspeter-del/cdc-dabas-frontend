export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRligFAIvCv';
  const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'tblNJ5etsbiMWAnMZ';

  if (!token) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN is not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const recordId = String(body.id || '').trim();
    const unique = body.unique === true;

    if (!/^rec[a-zA-Z0-9]+$/.test(recordId)) {
      return res.status(400).json({ error: 'Invalid record id' });
    }

    const recordUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${encodeURIComponent(recordId)}`;
    const headers = { Authorization: `Bearer ${token}` };

    const getResponse = await fetch(recordUrl, { headers });
    const recordData = await getResponse.json();

    if (!getResponse.ok) {
      return res.status(getResponse.status).json({
        error: 'Airtable request failed',
        message: recordData?.error?.message || 'Could not read property record'
      });
    }

    const fields = recordData.fields || {};
    const status = String(fields['Ingatlan státusza'] || '').trim().toLowerCase();
    const published = fields['Publikálva a weboldalon'] === true;

    if (status !== 'aktív' || !published) {
      return res.status(404).json({ error: 'Property not available' });
    }

    const views = Math.max(0, Number(fields['Megtekintések'] || 0));
    const uniqueViews = Math.max(0, Number(fields['Egyedi megtekintések'] || 0));
    const updatedFields = { 'Megtekintések': views + 1 };

    if (unique) {
      updatedFields['Egyedi megtekintések'] = uniqueViews + 1;
    }

    const patchResponse = await fetch(recordUrl, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: updatedFields })
    });

    const patchData = await patchResponse.json();

    if (!patchResponse.ok) {
      return res.status(patchResponse.status).json({
        error: 'Airtable update failed',
        message: patchData?.error?.message || 'Could not update view counters'
      });
    }

    return res.status(200).json({
      ok: true,
      megtekintesek: Number(patchData.fields?.['Megtekintések'] ?? views + 1),
      egyediMegtekintesek: Number(patchData.fields?.['Egyedi megtekintések'] ?? (unique ? uniqueViews + 1 : uniqueViews))
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
