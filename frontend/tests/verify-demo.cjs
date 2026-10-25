const path=require("node:path"),{spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,"../../demos/autonegotiater-multi-seller-demo/frontend");
const result=spawnSync(process.execPath,[path.join(root,"tests/verify-demo.cjs")],{cwd:root,stdio:"inherit",env:{...process.env,NODE_PATH:path.resolve(__dirname,"../node_modules")}});
process.exit(result.status??1);
