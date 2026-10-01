CDC Dabas – aktuális frontend

Funkciók:
- Airtable-ból csak az Aktív + Publikálva a weboldalon rekordok jelennek meg.
- Részletes kereső: eladó/kiadó, ingatlantípus, város autocomplete, ár, alapterület, szobaszám, szabad szavas keresés.
- Az ingatlankártya teljes képe és az adatlap ugyanazt az Airtable rekordot nyitja meg.
- ÚJ és KIZÁRÓLAGOS jelölés az Airtable checkbox mezői alapján.
- Részletes adatlap csak kitöltött jellemzőket mutat.
- Ildikó fotója az assets/ildiko.jpg fájlban.
- Kapcsolati űrlap a Resend API-n keresztül Ildikó címére, CC-vel.

Vercel környezeti változók:
AIRTABLE_TOKEN
AIRTABLE_BASE_ID
AIRTABLE_PROPERTIES_TABLE (opcionális, alapértelmezett: tblNJ5etsbiMWAnMZ)
RESEND_API_KEY
CONTACT_FROM_EMAIL (opcionális; a Resendben hitelesített feladói cím legyen)

Az email küldés csak a RESEND_API_KEY beállítása után működik.
A végleges jogi oldalon a hivatalos cégadatokat és az ingatlanközvetítői nyilvántartási számot ki kell tölteni.
