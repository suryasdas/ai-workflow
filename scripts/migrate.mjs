import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required. Copy .env.example to .env and set it first.");
  process.exit(1);
}

const client = new Client({ connectionString });
const migrationsDir = join(process.cwd(), "migrations");
const migrationFiles = (await readdir(migrationsDir))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();

await client.connect();
try {
  for (const fileName of migrationFiles) {
    const sql = await readFile(join(migrationsDir, fileName), "utf8");
    await client.query(sql);
    console.log(`Applied migration: ${fileName}`);
  }
} finally {
  await client.end();
}
