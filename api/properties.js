export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appBXDnRligFAIvCv';
  const table = process.env.AIRTABLE_PROPERTIES_TABLE || 'tblNJ5etsbiMWAnMZ';
  if (!token) return res.status(500).json({ error: 'AIRTABLE_TOKEN is not configured' });
  try {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error:'Airtable request failed', airtable:data?.error||null, message:data?.error?.message||'Unknown Airtable error', status:response.status });
    const records = data.records || [];
    const properties = records.filter(record => {
      const f=record.fields||{};
      return String(f['Ingatlan státusza']||'').trim().toLowerCase()==='aktív' && f['Publikálva a weboldalon']===true;
    }).map(record => {
      const f=record.fields||{};
      const photos=Array.isArray(f['Fotók']) ? f['Fotók'].map(x=>x.url||x.thumbnails?.large?.url).filter(Boolean) : [];
      return {
        id:record.id,
        ingatlanId:f['Ingatlan ID']??null,
        label:f['Label']??null,
        title:f['Cím']||'', city:f['Település']||'', type:f['Ingatlantípus']||'', deal:f['Eladó / Kiadó']||'',
        price:Number(f['Ár']||0),
        area:Number(f['Alapterület']??f['Négyzetméter']??f['Alapterület (m²)']??0),
        lot:Number(f['Telekméret']||0), rooms:Number(f['Szobák száma']||0), halfRooms:Number(f['Félszobák száma']||0), bathrooms:Number(f['Fürdőszobák száma']||0),
        description:f['Leírás']||'', photos, floorplan:Array.isArray(f['Alaprajz']) ? (f['Alaprajz'][0]?.url||'') : (f['Alaprajz']||''), map:f['Helyszín / térkép']||'',
        featured:f['Kiemelt ingatlan']===true, exclusive:f['Kizárólagos']===true, isNew:f['Új']===true,
        views:Number(f['Megtekintések']||0), inquiries:Number(f['Érdeklődések']||0), uniqueViews:Number(f['Egyedi megtekintések']||0),
        extra:{
          'Ingatlan állapota':f['Állapot']??f['Ingatlan állapota'], 'Építés éve':f['Építés éve'], 'Komfort':f['Komfort'], 'Emelet':f['Emelet'],
          'Épület szintjei':f['Épület szintjei'], 'Lift':f['Lift'], 'Belmagasság':f['Belmagasság'], 'Légkondicionáló':f['Klíma']??f['Légkondicionáló'],
          'Akadálymentesített':f['Akadálymentesített'], 'Fürdő és wc':f['Fürdő és wc'], 'Tájolás':f['Tájolás'], 'Kilátás':f['Kilátás'],
          'Erkély mérete':f['Erkély mérete'], 'Kertkapcsolatos':f['Kertkapcsolatos'], 'Tetőtér':f['Tetőtér'], 'Parkolás':f['Parkolás'],
          'Fűtés':f['Fűtés'], 'Szerkezet':f['Szerkezet'], 'Garázs':f['Garázs'], 'Pince':f['Pince'], 'Tároló':f['Tároló']
        }
      };
    });
    res.status(200).json({properties,totalRecords:records.length});
  } catch(error) { res.status(500).json({error:'Internal server error',message:error.message}); }
}
