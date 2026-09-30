export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRigFAlCv7c';

  if (!token) {
    return res.status(500).json({
      error: 'AIRTABLE_TOKEN is not configured'
    });
  }

  try {
    const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    return res.status(response.status).json({
      airtableStatus: response.status,
      airtableResponse: data
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Request failed',
      message: error.message
    });
  }
}
