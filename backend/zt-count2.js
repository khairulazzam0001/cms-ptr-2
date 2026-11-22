require('dotenv/config');
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cms_master',
  });
  for (const t of ['master_call', 'ref_mapping_group_rating', 'master_key_action', 'trans_batch_project', 'trans_participant', 'master_prompt', 'master_folder']) {
    const [r] = await c.query(`SELECT COUNT(*) n FROM \`${t}\``);
    console.log(t, r[0].n);
  }
  await c.end();
})();
