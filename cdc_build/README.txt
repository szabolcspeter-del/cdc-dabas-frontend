CDC Dabas frontend v2 – Airtable API kapcsolat előkészítve.

A /api/properties Vercel serverless endpoint biztonságosan az AIRTABLE_TOKEN környezeti változóból olvassa az Airtable adatokat.
Base ID: appBXDnRigFAlvCv
Táblázat: Ingatlanok
Publikus feltétel: Ingatlan státusza = Aktív és Publikálva a weboldalon = bejelölve.

Vercelben szükséges Environment Variables:
AIRTABLE_TOKEN = a saját Airtable Personal Access Tokened
AIRTABLE_BASE_ID = appBXDnRigFAlvCv
AIRTABLE_PROPERTIES_TABLE = Ingatlanok

A token soha ne kerüljön az index.html-be vagy GitHubra.
