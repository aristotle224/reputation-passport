import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const migrationDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');
    await pool.query(sql);
    console.log(`Migration ${file} complete`);
  }
  await pool.end();
}

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
