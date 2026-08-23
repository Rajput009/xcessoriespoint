/* SQLite backup: copies store.db to backups/ with a timestamp, keeps last 10.
 * Run: npm run backup   (cron it in production)
 *
 * Uses the SQLite Online Backup API (better-sqlite3's db.backup()) instead of a
 * raw file copy — required because the live DB runs in WAL mode, where recent
 * commits live in -wal and a plain copyFileSync can produce a torn snapshot.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = process.env.XP_DB_PATH || path.join(__dirname, "store.db");
const dir = path.join(__dirname, "..", "backups");

if (!fs.existsSync(src)) {
  console.error("No database found at", src);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = path.join(dir, `store-${stamp}.db`);

const srcDb = new Database(src, { readonly: true });
try {
  await srcDb.backup(dest);
} finally {
  srcDb.close();
}
console.log("Backup written:", dest, `(${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);

// retention: keep the 10 most recent
const backups = fs.readdirSync(dir).filter((f) => f.startsWith("store-")).sort().reverse();
for (const old of backups.slice(10)) {
  fs.unlinkSync(path.join(dir, old));
  console.log("Pruned old backup:", old);
}
