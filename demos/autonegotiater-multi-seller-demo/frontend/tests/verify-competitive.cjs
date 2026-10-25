const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/competitive.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { exports: exportsObject, structuredClone });
const { defaultRequirements: defaults, createCompetitiveSession: create, advanceCompetitiveRound: advance, competitiveView: view, rankedOffers: rank, approveCompetitiveOffer: approve, validateRequirements: validate, sellerCounteroffer } = exportsObject;
const cents = n => Math.round(n * 100);
let traces = 0;
function run(requirements = defaults, product = exportsObject.competitiveProduct) {
    let state = create(requirements, 4, product), guard = 0;
    const original = JSON.stringify(state);
    while (state.phase === 'running' && guard++ < 15) {
        const before = structuredClone(state);
        const next = advance(state);
        assert.equal(JSON.stringify(state), JSON.stringify(before), 'Advancing never mutates previous state');
        assert.equal(next.round, state.round + 1);
        assert.ok(next.round <= requirements.maxRounds);
        for (const seller of next.sellers) {
            const previous = state.sellers.find(s => s.inventory.id === seller.inventory.id);
            const own = seller.inventory;
            if (seller.status === 'excluded') assert.equal(seller.history.length, 0, 'Wrong specification and insufficient stock never negotiate');
            let last = Infinity;
            for (const m of seller.history) {
                assert.ok(m.round <= next.round);
                if (m.agent === 'Buyer Agent' && m.price !== undefined) assert.ok(cents(m.price) <= cents(requirements.maximumPrice));
                if (m.agent === 'Seller Agent' && m.price !== undefined) assert.ok(cents(m.price) >= cents(own.minimumPrice));
                if (m.action === 'counteroffer') { assert.ok(m.price <= last); last = m.price; }
                if (m.agent === 'Market update') {
                    assert.equal(m.action, 'announcement');
                    assert.ok(m.price <= requirements.maximumPrice);
                    assert.ok(!next.sellers.some(s => m.explanation.includes(s.inventory.name)), 'Seller-facing market announcement is anonymous');
                    const reference = state.sellers.some(s => s.inventory.id !== own.id && s.inventory.productKey === own.productKey && s.inventory.stock >= requirements.quantity && s.inventory.deliveryDays <= requirements.deliveryDays && s.currentPrice === m.price);
                    if (m.round === next.round) assert.ok(reference, 'Competition comes from a real eligible opposing offer in the previous snapshot');
                }
            }
            if (seller.agreedPrice !== undefined) {
                assert.equal(seller.status, 'agreed'); assert.ok(seller.agreedPrice <= requirements.maximumPrice);
                assert.ok(own.stock >= requirements.quantity && own.deliveryDays <= requirements.deliveryDays);
                const pair = seller.history.slice(-2);
                assert.equal(pair[0].agent, 'Buyer Agent'); assert.equal(pair[1].agent, 'Seller Agent');
                pair.forEach(m => { assert.equal(m.action, 'accept'); assert.equal(m.price, seller.agreedPrice); });
            }
            if (previous.currentPrice !== undefined && seller.currentPrice !== undefined) assert.ok(seller.currentPrice <= previous.currentPrice);
        }
        const projection = view(next, 4);
        assert.ok(!/"(?:minimumPrice|inventory|concession)"/.test(JSON.stringify(projection)), 'Buyer view excludes Seller private limits');
        assert.equal(view(next, 5), null);
        assert.equal(next.approvedSellerId, undefined, 'The engine never approves automatically');
        state = next;
    }
    assert.equal(state.phase, 'review'); assert.ok(guard <= 12);
    assert.equal(advance(state), state, 'Terminal engine is stable');
    assert.equal(JSON.stringify(create(requirements, 4, product)), original, 'Fixture state is isolated');
    traces++; return state;
}
const completed = run();
const final = view(completed, 4), offers = rank(final);
assert.equal(offers.length, 2);
assert.equal(offers[0].id, 'jeddah'); assert.equal(offers[0].agreedPrice, 3980);
assert.equal(offers[1].id, 'riyadh'); assert.equal(offers[1].agreedPrice, 4050);
assert.equal(completed.sellers.find(s => s.inventory.id === 'dammam').status, 'excluded');
assert.equal(completed.sellers.find(s => s.inventory.id === 'premium').status, 'rejected');
assert.equal(completed.sellers.find(s => s.inventory.id === 'limited').status, 'excluded');
assert.equal(completed.sellers.find(s => s.inventory.id === 'different'), undefined, 'Unrelated catalog IDs are not part of this product session');
assert.ok(completed.announcements.length >= 2);
const riyadh = completed.sellers.find(s => s.inventory.id === 'riyadh');
assert.ok(riyadh.history.some(m => m.action === 'counteroffer' && m.explanation.includes('anonymous')));
assert.equal(sellerCounteroffer(riyadh.inventory, 4, 4400, 4250), 4225, 'Competitive price pressure lowers the scheduled 4250 price');
assert.equal(approve(completed, 'dammam', 4), completed);
assert.equal(approve(completed, 'jeddah', 5), completed);
assert.equal(approve(create(defaults, 4), 'jeddah', 4).phase, 'running');
const approved = approve(completed, 'jeddah', 4);
assert.equal(approved.phase, 'approved'); assert.equal(approved.approvedSellerId, 'jeddah');
assert.equal(approve(approved, 'riyadh', 4), approved, 'Approval is idempotent');
assert.equal(approve(completed, 'riyadh', 4).approvedSellerId, 'riyadh', 'Buyer may prefer any eligible offer');
const tampered = structuredClone(completed);
tampered.sellers.find(s => s.inventory.id === 'jeddah').history.pop();
assert.equal(approve(tampered, 'jeddah', 4), tampered, 'A mismatched agent acceptance cannot be approved');
const reversed = create(defaults, 4); reversed.sellers.reverse();
let a = create(defaults, 4), b = reversed;
for(let i = 0; i < 6; i++) { a = advance(a); b = advance(b); }
for(const seller of a.sellers) assert.equal(JSON.stringify(seller.history), JSON.stringify(b.sellers.find(s => s.inventory.id === seller.inventory.id).history), 'Interleaving order cannot favor a Seller');
for(const quantity of [1, 10, 25, 100]) for(const deliveryDays of [1, 7, 12]) for(const maxRounds of [1, 3, 12]) for(const maximumPrice of [3900, 4300, 5000]) {
    run({ quantity, deliveryDays, maxRounds, maximumPrice, targetPrice: Math.min(4000, maximumPrice) });
}
assert.equal(rank(view(run({ ...defaults, maximumPrice: 3900, targetPrice: 3800 }), 4)).length, 0, 'No forced Agreement below every participating Seller floor');
assert.equal(rank(view(run({ ...defaults, deliveryDays: 1 }), 4)).length, 0, 'No Agreement after a delivery failure');
assert.equal(rank(view(run({ ...defaults, quantity: 100 }), 4)).length, 0, 'No Agreement without stock');
const stalled = run({ ...defaults, maxRounds: 12 }); assert.ok(stalled.round < 12); assert.ok(stalled.stopReason.includes('No Seller Agent improved'));
for(const bad of [{quantity:0},{quantity:1.5},{quantity:Infinity},{targetPrice:4301},{targetPrice:NaN},{maximumPrice:0},{maximumPrice:4300.001},{deliveryDays:0},{maxRounds:0},{maxRounds:13}]) assert.ok(validate({...defaults,...bad}));
assert.equal(validate({...defaults, targetPrice:4000.01, maximumPrice:4300.01}),null);
run({ ...defaults, targetPrice: 4000.01, maximumPrice: 4300.01 });
assert.equal(validate(defaults),null);
assert.ok(!JSON.stringify(approved).includes('paymentId'));
console.log(`PASS: ${traces} competitive simulations; exact product/stock/delivery eligibility, independent histories, anonymous competition, integer SAR bounds, matching acceptances, multiple Agreements, failure, finite stopping, order independence, privacy and manual approval.`);

const {advanceCompetitiveStep: step, requirementsFor, sellerCatalog, catalogIdentity} = exportsObject;
const fixtureExports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/mock-data.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:fixtureExports,require:()=>exportsObject});
let tickCount=0;
for(const product of fixtureExports.mockProducts){
    const req=requirementsFor(product);
    const preview=sellerCatalog(product,req);
    assert.ok(preview.length>=3);
    assert.ok(preview.every(s=>s.catalogId===catalogIdentity(product.id) && s.exactProduct));
    assert.ok(preview.some(s=>s.status==='excluded' && s.reason.includes('deadline')));
    assert.ok(preview.some(s=>s.status==='excluded' && s.reason.includes('units')));
    let progressive=create(req,4,product), guard=0;
    assert.ok(progressive.sellers.every(s=>s.history.length===0), 'Confirmation creates an empty initial state');
    const expected=run(req,product);
    while(progressive.phase==='running' && guard++<500){
        const before=structuredClone(progressive);
        const previousMessages=before.sellers.reduce((n,s)=>n+s.history.length,0);
        const next=step(progressive);
        assert.equal(JSON.stringify(progressive),JSON.stringify(before),'Ticks do not mutate their input');
        const messages=next.sellers.reduce((n,s)=>n+s.history.length,0);
        assert.equal(messages,previousMessages+1,'A timed step reveals exactly one message');
        const visible=view(next,4);
        assert.ok(!/"(?:pending|target|events|minimumPrice|concession|inventory)"/.test(JSON.stringify(visible)), 'Future round results and private engine fields never reach a view');
        for(const seller of next.sellers){
            if(seller.agreedPrice!==undefined){
                assert.equal(seller.status,'agreed');
                assert.ok(seller.history.slice(-2).every(m=>m.action==='accept' && m.price===seller.agreedPrice));
            }
            assert.ok(seller.inventory.productKey===next.catalogId);
        }
        assert.ok(visible.completedRounds<=visible.round);
        assert.equal(approve(next,next.sellers[0].inventory.id,5),next,'Wrong Buyer cannot approve');
        progressive=next;tickCount++;
    }
    assert.ok(guard<500);assert.equal(JSON.stringify(progressive),JSON.stringify(expected),'Progressive rendering preserves the deterministic final result');
    assert.equal(progressive.productId,product.id);
    assert.ok(rank(view(progressive,4)).length>=1);
    const reset=create(req,4,product); assert.equal(reset.round,0);assert.equal(reset.announcements.length,0);assert.ok(reset.sellers.every(s=>s.history.length===0));
    run({...req,quantity:100},product);
    run({...req,deliveryDays:1},product);
}
const newListing={...fixtureExports.mockProducts[0],id:99,name:fixtureExports.mockProducts[0].name};
const freshCatalog=sellerCatalog(newListing,requirementsFor(newListing));
assert.equal(freshCatalog.length,1,'New unregistered listings have only their own Seller, never inferred matches');
assert.notEqual(freshCatalog[0].catalogId,catalogIdentity(1),'Identical names do not create a catalog match');
assert.equal(sellerCatalog(fixtureExports.mockProducts[0],{...requirementsFor(fixtureExports.mockProducts[0]),quantity:3})[0].status,'excluded','Current listing stock is honored');
console.log(`PASS: all ${fixtureExports.mockProducts.length} products; ${tickCount} progressive ticks; catalog identity, delivery/stock prechecks, unknown-listing isolation, per-message privacy, zero-history confirmation, restart and round/step equivalence.`);
