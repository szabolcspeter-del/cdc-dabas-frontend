export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: 'AIRTABLE_TOKEN is not configured'
    });
  }

  try {
    // 1. Lekérjük az API által ténylegesen látható base-eket
    const basesResponse = await fetch(
      'https://api.airtable.com/v0/meta/bases',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const basesData = await basesResponse.json();

    if (!basesResponse.ok) {
      return res.status(basesResponse.status).json({
        step: 'list-bases',
        airtable: basesData
      });
    }

    const base = basesData.bases?.[0];

    if (!base) {
      return res.status(404).json({
        error: 'No bases visible to this token'
      });
    }

    // 2. AZ AIRTABLE ÁLTAL VISSZAADOTT ID-t használjuk
    const tablesResponse = await fetch(
      `https://api.airtable.com/v0/meta/bases/${base.id}/tables`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const tablesData = await tablesResponse.json();

    return res.status(tablesResponse.status).json({
      baseFromApi: base,
      tablesStatus: tablesResponse.status,
      tables: tablesData
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Request failed',
      message: error.message
    });
  }
}
