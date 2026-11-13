require('dotenv/config');
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cms_master',
  });
  const q = async (s) => (await c.query(s))[0];
  console.log('AD:', JSON.stringify(await q('SELECT assessment_design_id, assessment_design_name, level_id, design_id FROM master_assessment_design WHERE is_deleted = 0')));
  console.log('detail sim:', JSON.stringify(await q('SELECT assessment_design_id, simulation_id FROM master_assessment_design_detail_simulation WHERE is_deleted = 0')));
  console.log('detail comp:', JSON.stringify(await q('SELECT assessment_design_id, competency_id FROM master_assessment_design_detail_competency WHERE is_deleted = 0')));
  console.log('activity by design/level:', JSON.stringify(await q('SELECT design_id, level_id, COUNT(*) n FROM master_activity WHERE is_deleted = 0 GROUP BY design_id, level_id')));
  console.log('activity by design/sim:', JSON.stringify(await q('SELECT design_id, simulation_id, COUNT(*) n FROM master_activity WHERE is_deleted = 0 GROUP BY design_id, simulation_id')));
  console.log('folder by design:', JSON.stringify(await q('SELECT design_id, COUNT(*) n FROM master_folder WHERE is_deleted = 0 GROUP BY design_id')));
  console.log('actor by design:', JSON.stringify(await q('SELECT design_id, COUNT(*) n FROM master_actor WHERE is_deleted = 0 GROUP BY design_id')));
  console.log('doc by design via activity:', JSON.stringify(await q('SELECT a.design_id, COUNT(DISTINCT d.document_id) n FROM master_document d JOIN master_activity a ON a.activity_id = d.activity_id WHERE d.is_deleted = 0 GROUP BY a.design_id')));
  console.log('chat by design:', JSON.stringify(await q('SELECT a.design_id, COUNT(*) n FROM master_chat ch JOIN master_activity a ON a.activity_id = ch.activity_id WHERE ch.is_deleted = 0 GROUP BY a.design_id')));
  console.log('email by design:', JSON.stringify(await q('SELECT a.design_id, COUNT(*) n FROM master_email e JOIN master_activity a ON a.activity_id = e.activity_id WHERE e.is_deleted = 0 GROUP BY a.design_id')));
  console.log('scenario by design:', JSON.stringify(await q('SELECT a.design_id, COUNT(*) n FROM master_scenario_activity s JOIN master_activity a ON a.activity_id = s.activity_id WHERE s.is_deleted = 0 GROUP BY a.design_id')));
  await c.end();
})();
