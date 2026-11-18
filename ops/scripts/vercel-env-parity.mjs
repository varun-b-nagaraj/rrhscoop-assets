#!/usr/bin/env node
// ADR 0012: every Vercel variable is one entry that targets both Production and Preview, so staging
// and production differ only in the code they run. Needs a logged-in Vercel CLI; it reads keys and
// targets only, never values. Run after adding or changing any variable: npm run check:vercel-env
import { execFileSync } from 'node:child_process';

const PROJECT = 'prj_4CjaRmb0iZIgHeLAP7UHJdNDNVa2';
const TEAM = 'team_W0SExOuwmOANb95rcDI9NoTu';
const raw = execFileSync('npx', ['-y', 'vercel@latest', 'api', `/v10/projects/${PROJECT}/env?teamId=${TEAM}`],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const { envs } = JSON.parse(raw.slice(raw.indexOf('{')));

const byKey = new Map();
for (const env of envs) byKey.set(env.key, [...(byKey.get(env.key) || []), env]);

const problems = [];
for (const [key, entries] of [...byKey].sort()) {
  const targets = entries.flatMap(e => e.target || []);
  if (entries.length > 1) problems.push(`${key}: ${entries.length} separate entries; use one entry for both environments`);
  for (const needed of ['production', 'preview']) if (!targets.includes(needed)) problems.push(`${key}: missing ${needed}`);
  if (entries.some(e => e.gitBranch)) problems.push(`${key}: limited to a branch`);
}
if (problems.length) {
  console.error(`vercel-env-parity: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`vercel-env-parity: all ${byKey.size} variables are single entries targeting Production and Preview.`);
