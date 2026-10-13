const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
let count = 0;
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(tsx?|css)$/.test(entry.name)) {
      const source = fs.readFileSync(file, 'utf8');
      assert.ok(!/\p{Script=Arabic}/u.test(source), `${file}: Arabic text found`);
      assert.ok(!/(?:dir|lang)=["'](?:rtl|ar)["']/.test(source), `${file}: Arabic/RTL attribute found`);
      count++;
    }
  }
}
for (const directory of ['app', 'components', 'lib']) scan(path.join(root, directory));
assert.ok(fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8').includes('<html lang="en" dir="ltr">'));
const reports = fs.readFileSync(path.join(root, 'components/admin-reports.tsx'), 'utf8');
assert.ok(reports.includes('dir="ltr" lang="en"'));
assert.ok(!reports.includes('text-right'));
const pdf = fs.readFileSync(path.join(root, 'lib/report-download.ts'), 'utf8');
assert.ok(pdf.includes('direction = "ltr"'));
assert.ok(pdf.includes('textAlign = "left"'));
console.log(`PASS: ${count} frontend source files use English text; root, Reports and PDF layout are left-to-right.`);
