require('dotenv/config');
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cms_master',
  });
  const q = async (s, p) => (await c.query(s, p))[0];

  for (const adId of ['design-02-COPY', 'design-02-COPY-COPY']) {
    const [ad] = await q('SELECT * FROM master_assessment_design WHERE assessment_design_id = ?', [adId]);
    if (!ad) { console.log('MISSING AD', adId); continue; }
    const design = ad.design_id;
    const [acts] = await q('SELECT COUNT(*) n FROM master_activity WHERE design_id = ? AND is_deleted = 0', [design]);
    const [scn] = await q(
      `SELECT COUNT(*) n,
              SUM(s.document_id IS NOT NULL AND d.document_id IS NULL) bad_doc,
              SUM(d.document_id IS NOT NULL AND d.activity_id IS NOT NULL AND da.design_id <> ?) wrong_design_doc,
              SUM(s.actor_id IS NOT NULL AND ac.actor_id IS NULL) bad_actor
       FROM master_scenario_activity s
       JOIN master_activity a ON a.activity_id = s.activity_id
       LEFT JOIN master_document d ON d.document_id = s.document_id
       LEFT JOIN master_activity da ON da.activity_id = d.activity_id
       LEFT JOIN master_actor ac ON ac.actor_id = s.actor_id
       WHERE a.design_id = ? AND s.is_deleted = 0`,
      [design, design],
    );
    const [chat] = await q(
      `SELECT COUNT(*) n, SUM(ch.actor_id IS NOT NULL AND ac.actor_id IS NULL) bad_actor
       FROM master_chat ch JOIN master_activity a ON a.activity_id = ch.activity_id
       LEFT JOIN master_actor ac ON ac.actor_id = ch.actor_id
       WHERE a.design_id = ? AND ch.is_deleted = 0`,
      [design],
    );
    const [mail] = await q(
      `SELECT COUNT(*) n, SUM(e.actor_from IS NOT NULL AND ac.actor_id IS NULL) bad_actor
       FROM master_email e JOIN master_activity a ON a.activity_id = e.activity_id
       LEFT JOIN master_actor ac ON ac.actor_id = e.actor_from
       WHERE a.design_id = ? AND e.is_deleted = 0`,
      [design],
    );
    const [att] = await q(
      `SELECT COUNT(*) n, SUM(c.document_content_id IS NULL) bad_content
       FROM master_email_attachment x
       JOIN master_email e ON e.email_id = x.email_id
       JOIN master_activity a ON a.activity_id = e.activity_id
       LEFT JOIN master_document_content c ON c.document_content_id = x.doc_content_id
       WHERE a.design_id = ? AND x.is_deleted = 0`,
      [design],
    );
    const [docs] = await q(
      `SELECT COUNT(*) n, SUM(d.folder_id IS NOT NULL AND f.folder_id IS NULL) bad_folder
       FROM master_document d
       JOIN master_activity a ON a.activity_id = d.activity_id
       LEFT JOIN master_folder f ON f.folder_id = d.folder_id
       WHERE a.design_id = ? AND d.is_deleted = 0`,
      [design],
    );
    const [actors] = await q('SELECT COUNT(*) n, SUM(ac.superior IS NOT NULL AND sup.actor_id IS NULL) bad_sup FROM master_actor ac LEFT JOIN master_actor sup ON sup.actor_id = ac.superior WHERE ac.design_id = ? AND ac.is_deleted = 0', [design]);
    const [folders] = await q('SELECT COUNT(*) n, SUM(f.owner IS NOT NULL AND ac.actor_id IS NULL) bad_owner FROM master_folder f LEFT JOIN master_actor ac ON ac.actor_id = f.owner WHERE f.design_id = ? AND f.is_deleted = 0', [design]);
    const [dc] = await q('SELECT COUNT(*) n FROM master_assessment_design_detail_competency WHERE assessment_design_id = ? AND is_deleted = 0', [adId]);
    const [ds] = await q('SELECT COUNT(*) n FROM master_assessment_design_detail_simulation WHERE assessment_design_id = ? AND is_deleted = 0', [adId]);

    console.log(`\n=== ${adId} -> design ${design} (${ad.assessment_design_name})`);
    console.log(`detail comp=${dc.n} sim=${ds.n} activity=${acts.n} scenario=${scn.n} chat=${chat.n} email=${mail.n} attachment=${att.n} doc=${docs.n} actor=${actors.n} folder=${folders.n}`);
    console.log('bad refs:', {
      scenario_doc_missing: Number(scn.bad_doc || 0),
      scenario_doc_wrong_design: Number(scn.wrong_design_doc || 0),
      scenario_actor_missing: Number(scn.bad_actor || 0),
      chat_actor_missing: Number(chat.bad_actor || 0),
      email_actor_missing: Number(mail.bad_actor || 0),
      attachment_content_missing: Number(att.bad_content || 0),
      doc_folder_missing: Number(docs.bad_folder || 0),
      actor_superior_missing: Number(actors.bad_sup || 0),
      folder_owner_missing: Number(folders.bad_owner || 0),
    });
  }

  const orphanCopyDocs = await q(
    `SELECT d.document_id FROM master_document d LEFT JOIN master_folder f ON f.folder_id = d.folder_id
     WHERE d.document_id LIKE '%-COPY%' AND d.folder_id IS NOT NULL AND f.folder_id IS NULL`,
  );
  console.log('\ncopy doc dengan folder hilang:', orphanCopyDocs.length);

  const [fks] = await c.query(
    `SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE k
     WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
  );
  let orphan = 0;
  for (const f of fks) {
    const [r] = await q(
      `SELECT COUNT(*) n FROM \`${f.TABLE_NAME}\` ch
       LEFT JOIN \`${f.REFERENCED_TABLE_NAME}\` pa ON pa.\`${f.REFERENCED_COLUMN_NAME}\` = ch.\`${f.COLUMN_NAME}\`
       WHERE ch.\`${f.COLUMN_NAME}\` IS NOT NULL AND pa.\`${f.REFERENCED_COLUMN_NAME}\` IS NULL`,
    );
    if (r.n) { orphan += r.n; console.log('ORPHAN', f.TABLE_NAME, f.COLUMN_NAME, r.n); }
  }
  console.log(orphan ? `TOTAL ORPHAN: ${orphan}` : 'FK: tidak ada yang menggantung');
  await c.end();
})();
