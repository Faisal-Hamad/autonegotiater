const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict"),ts=require("typescript"),cp=require("node:child_process");
const root=path.join(__dirname,".."),env={NODE_ENV:"production",USE_MOCK_DATA:"true"};let fetches=0;
const cache={};function load(file){if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env},structuredClone,AbortSignal,require:n=>load(path.posix.join(path.posix.dirname(file),n+".ts")),fetch:async()=>{fetches++;throw Error("No network permitted");}});return exports;}
(async()=>{const api=load("lib/api.ts");assert.equal(api.isMockDataEnabled(),false,"Ordinary production build stays real even when USE_MOCK_DATA=true");
 env.NEXT_PUBLIC_AUTONEG_DEMO_BUILD="true";env.USE_MOCK_DATA="false";env.API_INTERNAL_URL="http://never-contact.invalid";
 assert.equal(api.isIsolatedDemoBuild(),true);assert.equal(api.isMockDataEnabled(),true);
 assert.equal((await api.getProducts()).length,7);assert.equal((await api.getProduct(7)).name,"Dell XPS 15");
 await api.getBuyerDashboard();await api.getSellerDashboard();await api.getAdminDashboard();
 await assert.rejects(()=>api.requestWorkspace("approve",undefined),e=>e.code==="INTEGRATION_BLOCKED");assert.equal(fetches,0);
 const guard=path.join(root,"release/aws-demo/demo-network-guard.cjs");
 const code=`require(${JSON.stringify(guard)});const a=require('node:assert/strict');for(const call of [()=>require('node:net').connect(9,'127.0.0.1'),()=>require('node:tls').connect(9,'127.0.0.1'),()=>require('node:http').get('http://never-contact.invalid'),()=>require('node:https').get('https://never-contact.invalid')])a.throws(call,/outbound application networking/);fetch('https://never-contact.invalid').then(()=>process.exit(1),e=>{a.match(e.message,/outbound application networking/);console.log('guard PASS')});`;
 assert.match(cp.execFileSync(process.execPath,["-e",code],{encoding:"utf8"}),/guard PASS/);
 for(const file of ["release/Containerfile","release/aws-demo/Containerfile"]){const content=fs.readFileSync(path.join(root,file),"utf8");const build=content.split(/FROM .* AS build/)[1].split(/FROM /)[0];assert.match(build,/COPY --from=deps \/app\/package.json \/app\/package-lock.json \.\//,"Build stage needs package manifests before npm run build");assert(build.indexOf("/app/package.json")<build.indexOf("RUN npm run build"));}
 const shell=fs.readFileSync(path.join(root,"components/site-shell.tsx"),"utf8");assert(shell.includes("DEMO MODE"));
 console.log("PASS: isolated production demo uses all mock readers with zero API calls, standard production Mock guard remains intact, outbound TCP/TLS/HTTP/fetch denied, and both Containerfiles include build-stage manifests.");
})().catch(e=>{console.error(e);process.exitCode=1;});
