import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Language } from '../modules/assessment-data/entities';

// Seed awal master_language (idempotent). Jalankan: npm run seed:languages
const LANGUAGES: { language_id: string; language_name: string; native_name: string }[] = [
  { language_id: 'id', language_name: 'Indonesian', native_name: 'Bahasa Indonesia' },
  { language_id: 'en', language_name: 'English', native_name: 'English' },
  { language_id: 'ja', language_name: 'Japanese', native_name: '日本語' },
  { language_id: 'ko', language_name: 'Korean', native_name: '한국어' },
  { language_id: 'zh', language_name: 'Chinese', native_name: '中文' },
  { language_id: 'ar', language_name: 'Arabic', native_name: 'العربية' },
  { language_id: 'es', language_name: 'Spanish', native_name: 'Español' },
  { language_id: 'fr', language_name: 'French', native_name: 'Français' },
  { language_id: 'de', language_name: 'German', native_name: 'Deutsch' },
  { language_id: 'pt', language_name: 'Portuguese', native_name: 'Português' },
];

async function main() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? '',
    database: process.env.DB_NAME ?? 'cms_master',
    entities: [Language],
    synchronize: true,
  });
  await ds.initialize();
  const repo = ds.getRepository(Language);

  for (const l of LANGUAGES) {
    await repo.upsert(
      { ...l, is_active: true, is_deleted: false, created_by: 'system', modified_by: 'system' },
      ['language_id'],
    );
  }

  console.log(`Seed master_language selesai: ${LANGUAGES.length} bahasa`);
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
