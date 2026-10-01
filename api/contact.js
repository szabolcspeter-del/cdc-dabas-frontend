export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { name, phone, email, interest, message, privacy } = req.body || {};
  if (!name || !phone || !email || !message || !privacy) return res.status(400).json({ error: 'Hiányzó kötelező mező' });
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL || 'weboldal@cdcdabas.hu';
  if (!apiKey) return res.status(503).json({ error: 'Email szolgáltatás nincs beállítva', message: 'A weboldal email küldéséhez a RESEND_API_KEY környezeti változó beállítása szükséges.' });
  const html = `<h2>Új érdeklődés a CDC Dabas weboldaláról</h2><p><strong>Név:</strong> ${escapeHtml(name)}</p><p><strong>Telefon:</strong> ${escapeHtml(phone)}</p><p><strong>E-mail:</strong> ${escapeHtml(email)}</p><p><strong>Érdeklődés:</strong> ${escapeHtml(interest || '')}</p><p><strong>Üzenet:</strong><br>${escapeHtml(message).replace(/\n/g,'<br>')}</p>`;
  const r = await fetch('https://api.resend.com/emails', { method:'POST', headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'}, body:JSON.stringify({ from, to:['ildi.kovacs@cdci.hu'], cc:['peterkovacsildiko@gmail.com'], reply_to:email, subject:`Weboldali érdeklődés – ${name}`, html }) });
  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ error:'Email küldési hiba', message:data?.message || 'Ismeretlen hiba' });
  return res.status(200).json({ ok:true });
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
