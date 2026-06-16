import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required. Copy .env.example to .env and set it first.");
  process.exit(1);
}

const client = new Client({ connectionString });
const sql = await readFile(join(process.cwd(), "migrations", "001_create_support_workflow.sql"), "utf8");

await client.connect();
try {
  await client.query(sql);
  console.log("Database migration complete.");
} finally {
  await client.end();
}
