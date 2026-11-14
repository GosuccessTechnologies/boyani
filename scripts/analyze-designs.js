// Batch analyze inspirational design images with concurrency
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const REF = '/home/z/my-project/reference';
const OUT = path.join(REF, 'design-analyses');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const PROMPT = `You are a senior UI designer. Analyze this screenshot and output a concise structured design spec (max 220 words): 1) Page type & overall layout pattern 2) Header/nav structure 3) Hero section design 4) Section-by-section order with layout of each 5) Color palette (hex approx) 6) Typography character 7) Distinctive design touches. Be specific and factual.`;

const jobs = [];
// Homepage inspirations
for (const f of fs.readdirSync(path.join(REF, 'homepage-inspo/Homepage-inspirationals'))) {
  const m = f.match(/Homepage(\d+)\.png/i);
  if (m) jobs.push({ file: path.join(REF, `homepage-inspo/Homepage-inspirationals/${f}`), name: `homepage${m[1]}` });
}
// Website section inspirations
for (const f of fs.readdirSync(path.join(REF, 'websites-inspo/Websites-section-inspirationals'))) {
  const m = f.match(/inspirationals\s*\((\d+)\)/i);
  if (m) jobs.push({ file: path.join(REF, `websites-inspo/Websites-section-inspirationals/${f}`), name: `section${m[1]}` });
}
// Dashboard inspirations
for (const f of fs.readdirSync(path.join(REF, 'dashboard-inspo/Dashboard-inspirationals'))) {
  const m = f.match(/dashboards\s*\((\d+)\)/i);
  if (m) jobs.push({ file: path.join(REF, `dashboard-inspo/Dashboard-inspirationals/${f}`), name: `dash${m[1]}` });
}

function runJob(job, attempt = 1) {
  return new Promise((resolve) => {
    const outFile = path.join(OUT, `${job.name}.json`);
    const mdFile = path.join(OUT, `${job.name}.md`);
    if (fs.existsSync(mdFile) && fs.statSync(mdFile).size > 0) { console.log(`SKIP ${job.name}`); return resolve(true); }
    execFile('z-ai', ['vision', '-p', PROMPT, '-i', job.file, '-o', outFile], { timeout: 240000 }, (err) => {
      if (err) { console.log(`ERR ${job.name} (attempt ${attempt}): ${(err.message || '').slice(0, 60)}`); return resolve(false); }
      try {
        const d = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        const c = d.choices?.[0]?.message?.content || 'FAILED';
        if (c === 'FAILED') return resolve(false);
        fs.writeFileSync(mdFile, c);
        fs.unlinkSync(outFile);
        console.log(`DONE ${job.name}`);
        resolve(true);
      } catch (e) { console.log(`PARSE-ERR ${job.name}`); resolve(false); }
    });
  });
}

async function main() {
  console.log(`Total jobs: ${jobs.length}`);
  const CONCURRENCY = 1;
  const queue = [...jobs];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const job = queue.shift();
      // retry up to 3 times
      for (let attempt = 1; attempt <= 3; attempt++) {
        const ok = await runJob(job, attempt);
        if (ok) break;
        await new Promise(r => setTimeout(r, 60000 * attempt)); // backoff for rate limits
      }
    }
  });
  await Promise.all(workers);
  console.log('ALL COMPLETE');
  const done = fs.readdirSync(OUT).filter(f => f.endsWith('.md')).length;
  console.log(`Analyses saved: ${done}/${jobs.length}`);
}
main();
