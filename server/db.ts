import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
export function database(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,company TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspaces(user_id TEXT PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files(user_id TEXT NOT NULL REFERENCES users(id),id TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(user_id,id));
    CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),enquiry_id TEXT NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,room TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,brief TEXT NOT NULL,transcript TEXT NOT NULL DEFAULT '[]',drafts TEXT NOT NULL DEFAULT '[]',error TEXT NOT NULL DEFAULT '',request_id TEXT NOT NULL,UNIQUE(user_id,request_id));
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,call_id TEXT NOT NULL REFERENCES calls(id),created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS onboarding(user_id TEXT PRIMARY KEY REFERENCES users(id),status TEXT NOT NULL CHECK(status IN ('seen','skipped','completed')),updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,action TEXT NOT NULL,created INTEGER NOT NULL);
  `);
  return db;
}
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const passwordHash = (s: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(s, salt, 64).toString('hex')}`;
};
export function passwordMatches(password: string, stored: string) {
  const [salt, hex] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function addUser(db: DatabaseSync, email: string, password: string, company: string) {
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || !company.trim())
    throw new Error('Use a valid email, studio name and password of at least 12 characters.');
  const id = randomUUID();
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(
    id,
    email.trim().toLowerCase(),
    passwordHash(password),
    company.trim(),
  );
  db.prepare('INSERT INTO workspaces VALUES(?,0,?)').run(
    id,
    JSON.stringify({
      version: 1,
      settings: { company, city: 'Delhi NCR', defaultMarkup: 20, defaultGst: 18 },
      projects: [],
      rates: [],
      vendors: [],
      enquiries: [],
    }),
  );
  return id;
}
