const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict"),ts=require("typescript");
const root=path.join(__dirname,".."),env={NODE_ENV:"production",USE_MOCK_DATA:"true",API_INTERNAL_URL:"http://127.0.0.1:9"};
let status=200,body=[],failure=false,badJson=false,calls=[];
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env},structuredClone,AbortSignal,require:n=>{if(n==="./api-contracts")return load("lib/api-contracts.ts");throw Error("Unexpected runtime import: "+n);},fetch:async(url,options)=>{calls.push({url,options});if(failure)throw Error("private connection detail must not appear");return{status,ok:status>=200&&status<300,json:async()=>{if(badJson)throw Error("malformed JSON");return body;}};}});return exports;}
const api=load("lib/api.ts"),contracts=load("lib/api-contracts.ts");
const product={id:41,seller_id:12,name:"Public product",description:null,category:"Electronics",base_price:"4200.50",stock_quantity:10,image_url:null,created_at:"2026-10-19T08:00:00Z"};
(async()=>{
 assert.equal(api.isMockDataEnabled(),false);body=[{...product,min_acceptable_price:99,privateLimits:{floor:99},password:"not-a-real-password"}];
 const rows=await api.getProducts();assert.deepEqual(Object.keys(rows[0]).sort(),Object.keys(product).sort());assert.equal(rows[0].base_price,"4200.50");
 assert.equal(calls[0].options.cache,"no-store");assert.equal(calls[0].options.redirect,"error");assert(calls[0].options.signal);
 body=[];assert.equal((await api.getProducts()).length,0);
 body={...product,base_price:4200.5};assert.equal((await api.getProduct(41)).id,41);
 await assert.rejects(()=>api.getProduct(-1),e=>e.code==="INVALID_REQUEST");
 for(const patch of [{base_price:"NaN"},{base_price:-1},{stock_quantity:-1},{stock_quantity:1.5},{id:0},{seller_id:"12"},{created_at:"not-a-date"},{description:undefined}]){body=[{...product,...patch}];await assert.rejects(()=>api.getProducts(),e=>e.code==="INVALID_RESPONSE");}
 body=[product,product];await assert.rejects(()=>api.getProducts(),e=>e.code==="INVALID_RESPONSE");
 body={...product,id:42};await assert.rejects(()=>api.getProduct(41),e=>e.code==="INVALID_RESPONSE");
 body={unexpected:true};await assert.rejects(()=>api.getProducts(),e=>e.code==="INVALID_RESPONSE");
 badJson=true;await assert.rejects(()=>api.getProducts(),e=>e.code==="INVALID_RESPONSE");badJson=false;
 for(const [code,expected]of [[401,"UNAUTHORIZED"],[403,"FORBIDDEN"],[500,"UNAVAILABLE"]]){status=code;await assert.rejects(()=>api.getProducts(),e=>e.code===expected&&e.status===code);}
 status=404;assert.equal(await api.getProduct(41),null);await assert.rejects(()=>api.getProducts(),e=>e.code==="UNAVAILABLE");
 failure=true;await assert.rejects(()=>api.getProducts(),e=>e.code==="UNAVAILABLE"&&!e.message.includes("private connection"));failure=false;
 const count=calls.length;for(const operation of Object.keys(contracts.workspaceContracts))await assert.rejects(()=>api.requestWorkspace(operation,undefined),e=>e.code==="INTEGRATION_BLOCKED");
 for(const call of [api.getBuyerDashboard,api.getSellerDashboard,api.getAdminDashboard])await assert.rejects(()=>call(),e=>e.code==="INTEGRATION_BLOCKED");
 assert.equal(calls.length,count,"Private API boundaries must send no requests, including GET bootstrap");
 for(const role of ["buyer","seller","admin"]){const source=fs.readFileSync(path.join(root,"app/dashboard",role,"page.tsx"),"utf8");assert(source.includes(`<DemoScreen role="${role}"`));assert(!source.includes("getBuyerDashboard("));assert(!source.includes("getSellerDashboard("));assert(!source.includes("getAdminDashboard("));}
 console.log("PASS: real public API allowlist/validation, empty/404/401/403/500/network/JSON errors, production Mock isolation, blocked workspace operations and all role root gates; zero external requests.");
})().catch(e=>{console.error(e);process.exitCode=1;});
