export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { name, phone, email, interest, message, privacy, propertyId, propertyTitle, propertyCity } = req.body || {};
  if (!name || !phone || !email || !privacy) return res.status(400).json({ error: 'Kérjük, töltse ki a kötelező mezőket.' });
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO || 'ildi.kovacs@cdci.hu';
  const cc = process.env.CONTACT_CC || 'peterkovacsildiko@gmail.com';
  if (!apiKey) return res.status(500).json({ error: 'A kapcsolatfelvételi szolgáltatás nincs beállítva.' });
  const html = `<h2>Új érdeklődés a CDC Dabas weboldaláról</h2>${propertyTitle ? `<p><strong>Érdeklődő ingatlan:</strong> ${esc(propertyTitle)}${propertyCity ? ` (${esc(propertyCity)})` : ''}</p>` : ''}<p><strong>Név:</strong> ${esc(name)}</p><p><strong>Telefon:</strong> ${esc(phone)}</p><p><strong>E-mail:</strong> ${esc(email)}</p><p><strong>Érdeklődés:</strong> ${esc(interest||'')}</p><p><strong>Üzenet:</strong><br>${esc(message||'').replace(/\n/g,'<br>')}</p>`;
  const r = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'}, body:JSON.stringify({from:process.env.CONTACT_FROM||'CDC Dabas weboldal <onboarding@resend.dev>',to:[to],cc:[cc],reply_to:email,subject:`Weboldali érdeklődés – ${name}`,html}) });
  const data=await r.json();
  if(!r.ok) return res.status(502).json({error:'Az üzenetet nem sikerült elküldeni.',detail:data?.message||null});

  // Count an inquiry only after the email was accepted by Resend.
  if (propertyId) {
    try {
      const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRligFAIvCv';
      const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'tblNJ5etsbiMWAnMZ';
      const recordUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${encodeURIComponent(propertyId)}`;
      const rr = await fetch(recordUrl, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` } });
      if (rr.ok) {
        const record = await rr.json();
        const f = record.fields || {};
        if (String(f['Ingatlan státusza'] || '').trim().toLowerCase() === 'aktív' && f['Publikálva a weboldalon'] === true) {
          const count = Number(f['Érdeklődések'] || 0) + 1;
          await fetch(recordUrl, {
            method:'PATCH',
            headers:{Authorization:`Bearer ${process.env.AIRTABLE_TOKEN}`,'Content-Type':'application/json'},
            body:JSON.stringify({fields:{'Érdeklődések':count}})
          });
        }
      }
    } catch (_) {
      // The email has already been sent; a counter failure must not make the user resend the message.
    }
  }

  res.status(200).json({ok:true});
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
