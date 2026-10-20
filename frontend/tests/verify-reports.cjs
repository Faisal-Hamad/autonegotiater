const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,structuredClone,TextEncoder,Uint8Array,Blob});
  return exports;
}
const model = load('lib/demo-model.ts'), fixtures = load('lib/mock-data.ts');
const {buildReport,reportCsv,approval,reportDate} = load('lib/reports.ts');
const {jpegPagesPdf} = load('lib/report-download.ts');
const state = model.initialDemoState(fixtures.mockProducts);
const date = '2026-10-13T10:00:00Z';
assert.equal(reportDate(date), '13 Oct 2026, 10:00:00 UTC');
assert.equal(reportDate('2026-10-13T13:00:00+03:00'), reportDate(date));
assert.equal(reportDate('invalid'), 'Not available in the current data');
for (const [type,id] of [['seller',2],['buyer',4],['session',102]]) {
  const report=buildReport(state,type,id,date);
  const json=JSON.stringify(report);
  assert.ok(json.includes('1850.00 SAR'));
  assert.ok(json.includes('DEMO / SAMPLE DATA'));
  for (const key of ['budget','privateLimits','minimum','threshold','password','token']) assert.ok(!json.includes('"'+key+'"'));
  assert.ok(!json.includes('1900.00'));
  assert.ok(reportCsv(report).startsWith('\ufeff'));
  assert.ok(!/\p{Script=Arabic}/u.test(json + reportCsv(report)));
  assert.ok(reportCsv(report).includes('Generated at'));
  assert.equal(report.generatedAt, '13 Oct 2026, 10:00:00 UTC');
  assert.ok(json.includes('12 Oct 2026, 08:00:00 UTC'));
  assert.equal(report.sections.find(s=>s.title.startsWith('Chronological Offers') && s.title.endsWith('#102')).rows.length,3);
}
const seller=buildReport(state,'seller',2,date);
assert.ok(JSON.stringify(seller).includes('100.0% (1/1)'));
assert.ok(!JSON.stringify(seller).includes('seller1@'));
assert.ok(JSON.stringify(buildReport(state,'buyer',4,date)).includes('50.0% (1/2)'));
const empty=buildReport(state,'buyer',5,date);
assert.ok(JSON.stringify(empty).includes('Not available: no Negotiation Sessions'));
assert.equal(buildReport(state,'seller',4,date),null);
assert.equal(buildReport(state,'session',999,date),null);
const missingProduct=structuredClone(state); missingProduct.products=[];
assert.ok(JSON.stringify(buildReport(missingProduct,'session',102,date)).includes('Not available in the current data'));
const sensitive=structuredClone(state);
sensitive.sessions[1].budget=987654321;
sensitive.sessions[1].privateLimits={floor:876543210,asking:1,buyerTarget:1,rounds:4,threshold:1};
sensitive.users[1].password='NEVER_EXPORT_PASSWORD'; sensitive.users[1].token='NEVER_EXPORT_TOKEN';
sensitive.rules[0].minimum=765432109;
const safe=JSON.stringify(buildReport(sensitive,'session',102,date))+JSON.stringify(buildReport(sensitive,'seller',2,date));
for(const secret of ['987654321','876543210','765432109','NEVER_EXPORT_PASSWORD','NEVER_EXPORT_TOKEN']) assert.ok(!safe.includes(secret));
let advanced=model.initialDemoState(fixtures.mockProducts);
for(let n=0;n<50 && advanced.sessions[0].status==='active';n++) advanced=model.advanceSession(advanced,101);
advanced=model.finishDeal(advanced,advanced.sessions[0]);
assert.ok(JSON.stringify(buildReport(advanced,'buyer',4,date)).includes('100.0% (2/2)'));
assert.equal(buildReport(advanced,'session',101,date).sections.find(s=>s.title==='Completed Agreements').rows.length,1);
for (const status of ['active','failed','cancelled','rejected','awaiting_approval']) {
  const copy=structuredClone(state); copy.sessions[1].status=status;
  const report=buildReport(copy,'session',102,date);
  assert.ok(JSON.stringify(report).includes('No finalized Agreement price'));
  assert.ok(approval(copy.sessions[1]));
}
state.users[1].name='=HYPERLINK("bad")';
assert.ok(reportCsv(buildReport(state,'seller',2,date)).includes("'=HYPERLINK"));

const withReq = structuredClone(state);
withReq.requests = [{ id: 301, buyerId: 4, budget: 3500, mode: 'semi_automated', status: 'awaiting_approval', priceWeight: 0.5, productIds: [1, 3], sessionIds: [101, 102], warranty: 1, delivery: 'Buyer pickup', createdAt: '2026-10-13T08:00:00Z' }];
const reqReport = buildReport(model.projectDemoState(withReq, withReq.users[5]), 'request', 301, date);
assert.ok(reqReport, 'Multi-Seller Request Report is generated for Admin');
const reqJson = JSON.stringify(reqReport);
assert.ok(reqJson.includes('Multi-Seller Request Report #301'));
assert.ok(reqJson.includes('Multi-Seller Request Details'));
assert.ok(!reqJson.includes('"budget"'), 'Request report excludes private buyer budget');
const buyerWithReqReport = buildReport(model.projectDemoState(withReq, withReq.users[5]), 'buyer', 4, date);
assert.ok(JSON.stringify(buyerWithReqReport).includes('#301'), 'Buyer report includes Multi-Seller Requests section');

(async()=>{
  const pdf=jpegPagesPdf([new Uint8Array([255,216,255,217]),new Uint8Array([255,216,255,217])]);
  const text=await pdf.text();
  assert.equal(pdf.type,'application/pdf'); assert.ok(text.startsWith('%PDF-1.4')); assert.ok(text.includes('/Count 2'));
  const bytes=Buffer.from(await pdf.arrayBuffer()); const xref=Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(bytes.subarray(xref,xref+4).toString(),'xref');
  const entries=text.slice(text.indexOf('0000000000 65535 f')+'0000000000 65535 f \n'.length).split('\n');
  entries.slice(0,8).forEach((line,i)=>assert.ok(bytes.subarray(Number(line.slice(0,10))).toString().startsWith(`${i+1} 0 obj`)));
  console.log('PASS: report scope, statistics, empty/missing data, approval states, private field exclusion, UTF-8 CSV/formula protection, PDF byte offsets and pagination structure.');
})().catch(e=>{console.error(e);process.exitCode=1;});
