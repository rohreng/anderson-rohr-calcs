// One-off: screenshot each masonry calc page (default inputs) for diagram review.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { spawn } from 'node:child_process';
const root = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/(\w):/, '$1:'));
const pub = path.join(root, 'public');
const out = path.join(root, 'tools', 'masonry-audit', 'diagram-review');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.resolve(pub, '.' + rel);
  if (!p.startsWith(pub)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const calcs = ['masonry_anchor_bolt_calculator', 'masonry_anchor_calculator', 'masonry_asd_design_calculator', 'masonry_bearing_uplift_calculator', 'masonry_lap_length_calculator', 'masonry_lintel_asd_calculator', 'masonry_lintel_jamb_calculator', 'masonry_reinforced_wall_asd_calculator', 'unreinforced_cmu_wall_asd_calculator', 'embed_plate_beam_bearing_calculator'];
console.log('serving on', port, 'chrome:', chrome);
// Chrome only exits reliably here when launched via PowerShell Start-Process -Wait
// with file-redirected output (same pattern as run-audit.mjs runChrome).
async function runChrome(args) {
  const so = path.join(out, '.so.txt'), se = path.join(out, '.se.txt');
  const aq = args.map(x => `'${String(x).replaceAll("'", "''")}'`).join(',');
  const cmd = `$p=Start-Process -FilePath '${chrome}' -ArgumentList @(${aq}) -Wait -PassThru -RedirectStandardOutput '${so}' -RedirectStandardError '${se}'; exit $p.ExitCode`;
  const status = await new Promise(resolve => { const p = spawn('powershell.exe', ['-NoProfile', '-Command', cmd]); p.on('exit', resolve); });
  try { fs.rmSync(so, { force: true }); fs.rmSync(se, { force: true }); } catch { }
  return status;
}
for (const c of calcs) {
  const profile = path.join(out, '.p-' + c);
  const shot = path.join(out, c + '.png');
  const status = await runChrome(['--headless=new', '--disable-gpu', '--disable-software-rasterizer', '--no-sandbox', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--window-size=1440,3200', '--virtual-time-budget=5000', `--screenshot=${shot}`, `http://127.0.0.1:${port}/Calcs/${c}.html`]);
  console.log(c, status === 0 && fs.existsSync(shot) ? 'OK' : 'FAIL status=' + status);
  fs.rmSync(profile, { recursive: true, force: true });
}
fs.rmSync(path.join(out, '.p'), { recursive: true, force: true });
server.close();
