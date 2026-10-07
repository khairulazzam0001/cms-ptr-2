import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../modules/users/user.entity';
import { ExampleMaster } from '../modules/masters/example-master/example-master.entity';
import {
  AssessmentDesign,
  AssessmentDesignDetailCompetency,
  AssessmentDesignDetailSimulation,
  Competency,
  Design,
  Level,
  Simulation,
} from '../modules/assessment/entities';

async function main() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? '',
    database: process.env.DB_NAME ?? 'cms_master',
    entities: [
      User,
      ExampleMaster,
      Level,
      Design,
      Competency,
      Simulation,
      AssessmentDesign,
      AssessmentDesignDetailCompetency,
      AssessmentDesignDetailSimulation,
    ],
    synchronize: true,
  });
  await ds.initialize();

  // admin
  const repo = ds.getRepository(User);
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const hash = await bcrypt.hash(password, 10);
  const exist = await repo.findOne({ where: { username } });
  if (exist) { exist.passwordHash = hash; await repo.save(exist); }
  else { await repo.save(repo.create({ username, passwordHash: hash })); }
  console.log(`Seed admin OK -> username: ${username}`);

  // seed minimal agar dropdown Level/Design tidak kosong + contoh sesuai Lofi
  const levels = ds.getRepository(Level);
  if (!(await levels.findOne({ where: { level_id: '3' } }))) {
    await levels.save(levels.create({ level_id: '3', level_name: 'Level 3', level_desc: 'Default', created_by: 'seed' }));
  }
  const designs = ds.getRepository(Design);
  if (!(await designs.findOne({ where: { design_id: 'DSG-ALL' } }))) {
    await designs.save(designs.create({ design_id: 'DSG-ALL', design_name: 'DESIGN ALL', created_by: 'seed' }));
  }
  const comps = ds.getRepository(Competency);
  const seedComps = [
    { competency_id: 'COMP_DDI_BA', competency_name: 'Business Acumen', competency_desc: 'Business Acumen', level_id: '3' },
    { competency_id: 'COMP_DDI_CI', competency_name: 'Continuous Improvement', competency_desc: 'Continuous Improvement', level_id: '3' },
    { competency_id: 'COMP_DDI_CO', competency_name: 'Customer Orientation', competency_desc: 'Customer Orientation', level_id: '3' },
  ];
  for (const c of seedComps) {
    if (!(await comps.findOne({ where: { competency_id: c.competency_id } }))) {
      await comps.save(comps.create({ ...c, created_by: 'seed' }));
    }
  }
  const sims = ds.getRepository(Simulation);
  const seedSims = [
    { simulation_id: 'csr-ver-1', simulation_name: 'csr', simulation_desc: 'CSR simulation', duration: 30, channel_name: 'Csr', group_simulation_id: 'CSR', level_id: '3', status: 1 },
    { simulation_id: 'swot-ver-2', simulation_name: 'swot', simulation_desc: 'SWOT simulation', duration: 75, channel_name: 'Swot', group_simulation_id: 'SWOT', level_id: '3', status: 1 },
    { simulation_id: 'probono', simulation_name: 'probono', simulation_desc: 'Probono', duration: 94, group_simulation_id: 'probono', level_id: '3', status: 1 },
    { simulation_id: 'botleneck', simulation_name: 'botleneck', simulation_desc: 'Botleneck', duration: 35, group_simulation_id: 'botleneck', level_id: '3', status: 1 },
  ];
  for (const s of seedSims) {
    if (!(await sims.findOne({ where: { simulation_id: s.simulation_id } }))) {
      await sims.save(sims.create({ ...s, created_by: 'seed' } as any));
    }
  }
  const ads = ds.getRepository(AssessmentDesign);
  if (!(await ads.findOne({ where: { assessment_design_id: '10001' } }))) {
    await ads.save(ads.create({
      assessment_design_id: '10001',
      assessment_design_name: 'DESIGN ALL',
      level_id: '3',
      design_id: 'DSG-ALL',
      created_by: 'seed',
    }));
  }
  console.log('Seed master assessment OK');
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
