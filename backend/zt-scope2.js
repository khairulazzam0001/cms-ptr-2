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

  for (const adId of ['design-02', 'DESIGN-ALL']) {
    const [ad] = await q('SELECT * FROM master_assessment_design WHERE assessment_design_id = ?', [adId]);
    const sims = (await q('SELECT simulation_id FROM master_assessment_design_detail_simulation WHERE assessment_design_id = ? AND is_deleted = 0', [adId])).map((r) => r.simulation_id);
    const acts = await q(
      `SELECT activity_id, simulation_id FROM master_activity
       WHERE is_deleted = 0 AND design_id = ? AND (level_id = ? OR level_id IS NULL)
         AND (simulation_id IN (?) OR simulation_id IS NULL)`,
      [ad.design_id, ad.level_id, sims],
    );
    const A = new Set(acts.map((r) => r.activity_id));
    const scn = await q('SELECT scenario_activity_id, activity_id, triggered_activity_id, document_id, actor_id, target_actor_id FROM master_scenario_activity WHERE is_deleted = 0 AND activity_id IN (?)', [acts.map((r) => r.activity_id)]);
    const chats = await q('SELECT chat_id, activity_id, actor_id FROM master_chat WHERE is_deleted = 0 AND activity_id IN (?)', [acts.map((r) => r.activity_id)]);
    const emails = await q('SELECT email_id, activity_id, parent_activity_id, actor_from, actor_to, actor_cc FROM master_email WHERE is_deleted = 0 AND activity_id IN (?)', [acts.map((r) => r.activity_id)]);
    const docs = await q('SELECT document_id, activity_id, folder_id, owner FROM master_document WHERE is_deleted = 0 AND activity_id IN (?)', [acts.map((r) => r.activity_id)]);
    const docIds = new Set(docs.map((r) => r.document_id));
    const att = emails.length ? await q('SELECT attachment_id, email_id, doc_content_id FROM master_email_attachment WHERE is_deleted = 0 AND email_id IN (?)', [emails.map((r) => r.email_id)]) : [];

    const scnDocs = scn.map((r) => r.document_id).filter(Boolean);
    const contentIds = att.map((a) => a.doc_content_id).filter(Boolean);
    const contentDocs = contentIds.length ? (await q('SELECT document_id, document_content_id FROM master_document_content WHERE document_content_id IN (?)', [contentIds])) : [];
    const outsideTriggered = [...new Set(scn.map((r) => r.triggered_activity_id).filter(Boolean))].filter((x) => !A.has(x));
    const outsideScnDocs = [...new Set(scnDocs)].filter((d) => !docIds.has(d));
    const outsideContentDocs = [...new Set(contentDocs.map((r) => r.document_id))].filter((d) => !docIds.has(d));
    const outsideFolders = [...new Set(docs.map((r) => r.folder_id).filter(Boolean))];
    const actors = new Set([...scn.flatMap((r) => [r.actor_id, r.target_actor_id]), ...chats.map((r) => r.actor_id), ...emails.flatMap((r) => [r.actor_from, r.actor_to, r.actor_cc]), ...docs.map((r) => r.owner)].filter(Boolean));
    const actorRows = actors.size ? await q('SELECT actor_id, design_id, level_id, superior FROM master_actor WHERE actor_id IN (?)', [[...actors]]) : [];
    const outsideActors = actorRows.filter((r) => r.design_id !== ad.design_id || (r.level_id && r.level_id !== ad.level_id));

    console.log(`\n=== ${adId} (design ${ad.design_id}, level ${ad.level_id}) sims=${sims.length}`);
    console.log(`activities=${acts.length} scenarios=${scn.length} chats=${chats.length} emails=${emails.length} docs=${docs.length} attachments=${att.length}`);
    console.log('triggered di luar set:', outsideTriggered.length, outsideTriggered.slice(0, 5));
    console.log('scenario doc di luar set:', outsideScnDocs.length, outsideScnDocs.slice(0, 5));
    console.log('attachment doc di luar set:', outsideContentDocs.length, outsideContentDocs.slice(0, 5));
    console.log('folder dipakai docs:', outsideFolders);
    console.log('actor dipakai:', actors.size, 'di luar design/level:', outsideActors.length, outsideActors.slice(0, 5));
    console.log('parent_activity email di luar set:', [...new Set(emails.map((r) => r.parent_activity_id).filter(Boolean))].filter((x) => !A.has(x)).slice(0, 5));
    console.log('doc read_only:', JSON.stringify(docs.reduce((m, r) => { m[String(r.read_only)] = (m[String(r.read_only)] || 0) + 1; return m; }, {})));
  }
  console.log('\nfolder rows:', JSON.stringify(await q('SELECT folder_id, folder_name, assessment_design_id, level_id, design_id, sort, owner FROM master_folder')));
  console.log('null-sim activities:', JSON.stringify(await q('SELECT activity_id, activity_name, design_id, level_id FROM master_activity WHERE simulation_id IS NULL AND is_deleted = 0')));
  await c.end();
})();
