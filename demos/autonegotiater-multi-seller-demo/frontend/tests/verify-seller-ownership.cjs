const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
const engine = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/competitive.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: engine, structuredClone });
const { createCompetitiveSession: create, advanceCompetitiveStep: step, competitiveView: buyerView, sellerCompetitiveViews: sellerViews, sellerCompetitiveSession: lookup } = engine;
let state = create(engine.defaultRequirements, 4);
for (let n = 0; state.phase === "running" && n < 200; n++) state = step(state);
assert.notEqual(state.phase, "running");
const before = JSON.stringify(state);
for (const account of [1, 2, 3, 999]) {
    const views = sellerViews(state, account);
    assert.equal(views.length, state.sellers.filter(s => s.inventory.ownerSellerId === account).length);
    for (const view of views) {
        const own = state.sellers.find(s => s.inventory.id === view.storefrontId);
        assert.equal(own.inventory.ownerSellerId, account);
        assert.equal(view.minimumPrice, own.inventory.minimumPrice);
        assert.equal(view.currentPrice, own.currentPrice);
        assert.equal(JSON.stringify(view.history), JSON.stringify(own.history), "Real messages and sequence are preserved");
        assert.equal(JSON.stringify(lookup(state, account, view.id)), JSON.stringify(view));
        for (const otherAccount of [1, 2, 3].filter(id => id !== account)) assert.equal(lookup(state, otherAccount, view.id), null, "Direct foreign session denied");
        assert(!("maximumPrice" in view.requirements));
        assert(!("sellers" in view) && !("inventory" in view) && !("approvedSellerId" in view));
        assert.equal(view.announcements.length, own.history.filter(m => m.agent === "Market update").length);
        for (const a of view.announcements) for (const other of state.sellers) assert(!a.explanation.includes(other.inventory.name), "Announcement contains no storefront identity");
    }
}
assert.equal(lookup(state, 1, "unknown-session"), null);
const corrupted = structuredClone(state); corrupted.sellers[0].sellerAccountId = 2;
assert(!sellerViews(corrupted, 2).some(v => v.storefrontId === state.sellers[0].inventory.id), "Both ownership records must match");
assert.equal(buyerView(state, 4).sellers.length, state.sellers.length);
assert.equal(buyerView(state, 5), null);
assert(!JSON.stringify(buyerView(state, 4)).includes('"minimumPrice":'));
assert.equal(JSON.stringify(state), before, "Projection does not mutate shared state");
// Same product, three distinct owning accounts; identity changes recompute scope.
const a = sellerViews(state, 1).map(v => v.id), b = sellerViews(state, 2).map(v => v.id);
assert(a.length && b.length && a.every(id => !b.includes(id)));
console.log("PASS: own access, foreign/direct denial, identity switching, same-product isolation, Buyer access, verbatim messages, own minimums and anonymous announcements.");

const ownerByStore = new Map();
for (const product of [engine.competitiveProduct, { ...engine.competitiveProduct, id: 3, seller_id: 2 }, { ...engine.competitiveProduct, id: 5, seller_id: 3 }]) {
    for (const s of create(engine.defaultRequirements, 4, product).sellers) {
        const key = s.inventory.storefrontKey;
        assert(key && Number.isInteger(s.inventory.ownerSellerId));
        if (ownerByStore.has(key)) assert.equal(ownerByStore.get(key), s.inventory.ownerSellerId, "Stable storefront belongs to one explicit owner");
        ownerByStore.set(key, s.inventory.ownerSellerId);
    }
}
console.log("PASS: storefront keys keep a single explicit owner across different product listings.");
