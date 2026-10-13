// No build output, network requests or additional dependencies are needed.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const root = path.join(__dirname, "..");
const calls = [];
const env = { NODE_ENV: "development", USE_MOCK_DATA: "true" };
let responseStatus = 200;
function load(relative) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, structuredClone, process: { env },
    require: name => name === "./mock-data" ? fixtures : require(name),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: responseStatus === 200, status: responseStatus, json: async () => ({ source: "real-api-test-double" }) };
    },
  });
  return exports;
}
const fixtures = load("lib/mock-data.ts");
const model = load("lib/demo-model.ts");
const api = load("lib/api.ts");
function fresh() { return model.initialDemoState(fixtures.mockProducts); }
function rounds(state, id = 101, count = 50) { for (let i = 0; i < count && state.sessions.find(s=>s.id===id)?.status === "active"; i++) state = model.advanceSession(state, id); return state; }
async function run() {
  let state = rounds(fresh());
  assert.equal(state.sessions[0].status, "awaiting_approval");
  assert.equal(state.deals.length, 1, "Semi-automated agreement cannot close before buyer approval");
  state = model.finishDeal(state, state.sessions[0]);
  assert.equal(state.sessions[0].status, "completed");
  assert.equal(state.deals.length, 2);
  assert.equal(state.products[0].stock_quantity, 1);
  assert.equal(model.finishDeal(state, state.sessions[0]).deals.length, 2, "Approval is idempotent");
  assert.equal(state.notices.filter(n => n.href.endsWith("/202")).length, 2, "Both parties receive local notifications");
  state = fresh(); state.sessions[0].mode = "automated"; state = rounds(state);
  assert.equal(state.sessions[0].status, "completed");
  for (const reason of ["scenario", "budget", "disabled"]) {
    state = fresh();
    if (reason === "scenario") state.sessions[0].scenario = "failed";
    if (reason === "budget") state.sessions[0].budget = 1;
    if (reason === "disabled") state.rules[0].enabled = false;
    state = rounds(state);
    assert.equal(state.sessions[0].status, "failed");
    assert.equal(state.deals.length, 1);
  }
  for (const status of ["cancelled", "rejected"]) {
    state = fresh(); state.sessions[0].scenario = status === "rejected" ? "rejection" : "cancellation";
    if (status === "rejected") state = rounds(state);
    state = model.endSession(state, 101, status, 4);
    assert.equal(state.sessions[0].status, status);
    assert.equal(model.advanceSession(state, 101), state);
    assert.equal(model.finishDeal(state, state.sessions[0]), state);
    assert.equal(state.deals.length, 1);
  }
  state = fresh(); state.sessions[0].budget = 3900;
  state = rounds(state);
  assert.equal(state.sessions[0].status, "awaiting_approval");
  state = rounds(fresh()); state.products[0].stock_quantity = 0;
  state = model.finishDeal(state, state.sessions[0]);
  assert.equal(state.sessions[0].status, "failed", "Stock is rechecked before approval");
  assert.equal(state.deals.length, 1);
  state = fresh(); state.rules[0].discount = 5; state.sessions[0].budget = 3500; state = rounds(state);
  assert.equal(state.sessions[0].status, "failed", "Discount limit prevents an invalid agreement");
  assert.equal(model.visibleSessions(model.projectDemoState(state, state.users[1]), state.users[1]).length, 1);
  assert.equal(model.visibleSessions(model.projectDemoState(state, state.users[4]), state.users[4]).length, 0);
  assert.equal(model.visibleDeals(state, state.users[0]).length, 0);

  // Test every recorded agent turn, not just the final state.
  for (const budget of [0.01, 2000, 3119.99, 3120, 3500, 3900, 5000]) {
    for (const maxRounds of [1, 2, 4, 8]) {
      state = fresh(); state.sessions[0].budget = budget; state.rules[0].rounds = maxRounds;
      const floor = state.rules[0].minimum;
      state = rounds(state);
      const session = state.sessions[0];
      let buyerPrice = 0, sellerPrice = Infinity;
      session.rounds.forEach((turn, index) => {
        assert.equal(turn.agent, index % 2 === 0 ? "buyer" : "seller", "Agents alternate strictly");
        assert.ok(turn.number <= maxRounds, "Acceptance may follow the last counteroffer without opening another round");
        if (turn.agent === "buyer") assert.ok(turn.price <= budget, "Buyer agent never exceeds its budget");
        if (turn.agent === "seller") assert.ok(turn.price >= floor, "Seller agent never crosses its floor");
        if (turn.action === "offer") { assert.ok(turn.price >= buyerPrice); buyerPrice = turn.price; }
        if (turn.action === "counteroffer") { assert.ok(turn.price <= sellerPrice); sellerPrice = turn.price; }
        if (turn.action === "accept") assert.equal(turn.price, session.rounds[index - 1].price, "Accept the actual opposing offer");
      });
      assert.notEqual(session.status, "active", "Simulation terminates within bounded turns");
      if (session.agreedPrice !== undefined) assert.ok(session.agreedPrice >= floor && session.agreedPrice <= budget);
      if (budget < floor) assert.equal(session.status, "failed", "Disjoint limits cannot force an agreement");
    }
  }
  // Privacy is structural: forbidden fields are absent from the data delivered to views.
  state = rounds(fresh());
  for (const role of ["buyer", "seller", "admin"]) {
    const user = state.users.find(u=>u.role === role);
    const view = model.projectDemoState(state,user);
    for (const session of view.sessions) {
      assert.equal(Object.hasOwn(session,"privateLimits"),false);
      assert.equal(Object.hasOwn(session,"budget"),role === "buyer");
    }
    if (role !== "seller") assert.equal(view.rules.length,0);
    else assert.ok(view.rules.every(r=>state.products.some(p=>p.id===r.productId && p.seller_id===user.id)));
    const updated = model.mergeDemoView(state,{...view,notices:view.notices.map(n=>({...n,read:true}))},user);
    assert.equal(updated.sessions[0].budget,state.sessions[0].budget);
    assert.equal(updated.rules.length,state.rules.length,"A view update must preserve other sellers' rules");
  }
  state = fresh();
  assert.equal(model.endSession(state,101,"cancelled",5),state,"Another buyer cannot cancel this session");
  assert.equal(model.endSession(state,101,"rejected",4),state,"Cannot reject before agreement review");
  state = model.advanceSession(state,101); state.rules[0].minimum = 3700;
  state = model.advanceSession(state,101);
  assert.equal(state.sessions[0].status,"failed","Tightening a floor mid-session cannot produce an out-of-bounds counteroffer");
  state=fresh(); state.products[0].base_price="3933.37"; state.rules[0].minimum=3200.005; state.rules[0].discount=100; state.sessions[0].budget=3500.019;
  state=rounds(state);
  for(const turn of state.sessions[0].rounds){
    if(turn.agent==="buyer")assert.ok(turn.price<=3500.019);
    if(turn.agent==="seller")assert.ok(turn.price>=3200.005,"Round seller floors upward, never below them");
    assert.ok(Math.abs(turn.price*100-Math.round(turn.price*100))<1e-6,"Offers use integer halalas");
  }
  const buyerView=model.projectDemoState(state,state.users[3]);
  assert.equal(JSON.stringify(buyerView).includes('"privateLimits"'),false);
  assert.equal(JSON.stringify(buyerView).includes('"minimum"'),false);
  const sellerView=model.projectDemoState(state,state.users[0]);
  assert.equal(JSON.stringify(sellerView).includes('"budget"'),false);
  console.log("PASS: two-agent alternation, monotonic offers, pricing boundaries, max-round exhaustion, all four scenarios and role-data privacy.");
  const products = await api.getProducts(); products[0].name = "mutated";
  assert.notEqual((await api.getProducts())[0].name, "mutated");
  for (const id of [1, 2, 3]) assert.equal((await api.getSellerDashboard(id)).seller.id, id);
  await api.getBuyerDashboard(); await api.getAdminDashboard();
  assert.equal((await api.getProduct(1)).id, 1);
  assert.equal(await api.getProduct(999), null);
  assert.equal(calls.length, 0, "Mock performs no API calls");
  env.USE_MOCK_DATA = "false";
  await api.getProducts(); await api.getSellerDashboard(2); await api.getBuyerDashboard(4); await api.getAdminDashboard(); await api.getProduct(1);
  assert.deepEqual(calls.map(c=>c.url), ["http://localhost:8000/products", "http://localhost:8000/dashboard/seller?seller_id=2", "http://localhost:8000/dashboard/buyer?buyer_id=4", "http://localhost:8000/dashboard/admin", "http://localhost:8000/products/1"]);
  assert.ok(calls.every(c=>c.options.cache === "no-store"));
  responseStatus = 404; assert.equal(await api.getProduct(999), null);
  responseStatus = 500; await assert.rejects(api.getProducts(), /Failed to load products/);
  env.NODE_ENV = "production"; env.USE_MOCK_DATA = "true";
  assert.equal(api.isMockDataEnabled(), false);
  await assert.rejects(api.getProducts(), /Failed to load products/, "Production never falls back to Mock");
  console.log("PASS: negotiation modes, approval, rejection/cancellation terminal states, failure, rules, stock, notifications, identity scoping, fixture isolation, API contracts, 404/errors and production Mock protection.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
