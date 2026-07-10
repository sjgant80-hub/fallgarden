#!/usr/bin/env node
/**
 * Persistent retry loop for shipping fallgarden past the GH repo-create throttle.
 * Runs foreground · polls every 60s until success or 30 attempts (30min).
 */
import { execSync } from 'node:child_process';

const REPO = 'sjgant80-hub/fallgarden';
const DESC = 'Sovereign Obsidian-shape second brain · markdown + wikilinks + graph · fall-kit cascade · MIT';

const sh = (cmd) => {
  try { return { ok: true, out: execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: e.stdout?.toString() || '', err: e.stderr?.toString() || e.message }; }
};

for (let attempt = 1; attempt <= 30; attempt++) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] attempt ${attempt}/30`);

  // Check if repo already exists
  const check = sh(`gh api repos/${REPO} --jq .name 2>&1`);
  if (check.ok && check.out.trim() === 'fallgarden') {
    console.log(`[${ts}] repo exists · pushing local commits`);
    const push = sh(`git push -u origin main 2>&1`);
    console.log(`push: ${push.ok ? 'OK' : 'FAIL'} · ${(push.out || push.err).slice(-200)}`);
    if (push.ok) {
      sh(`gh api -X POST repos/${REPO}/pages -f source[branch]=main -f source[path]=/ -f build_type=legacy 2>&1`);
      sh(`git tag v1.0.0 2>&1`);
      sh(`git push origin v1.0.0 2>&1`);
      console.log(`[${ts}] SHIPPED · https://sjgant80-hub.github.io/fallgarden/`);
      process.exit(0);
    }
  } else {
    // Create + push
    const create = sh(`gh repo create ${REPO} --public --source=. --remote=origin --push --description "${DESC}" 2>&1`);
    if (create.ok || (create.out + create.err).includes('github.com/sjgant80-hub/fallgarden')) {
      sh(`gh api -X POST repos/${REPO}/pages -f source[branch]=main -f source[path]=/ -f build_type=legacy 2>&1`);
      sh(`git tag v1.0.0 2>&1`);
      sh(`git push origin v1.0.0 2>&1`);
      console.log(`[${ts}] SHIPPED · https://sjgant80-hub.github.io/fallgarden/`);
      process.exit(0);
    }
    console.log(`[${ts}] throttled: ${(create.err || create.out).slice(0, 150)}`);
  }

  // Wait 60s
  await new Promise(r => setTimeout(r, 60000));
}

console.log('exhausted 30 attempts');
process.exit(1);
