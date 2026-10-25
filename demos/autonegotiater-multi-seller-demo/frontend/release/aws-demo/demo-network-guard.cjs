"use strict";
// Demo artifact only. Load before Next.js. Keep inbound HTTP listening available,
// but deny outbound application TCP/TLS/HTTP/fetch, even if an API URL is injected.
const deny = () => { throw new Error("DEMO MODE: outbound application networking is disabled."); };
require("node:net").Socket.prototype.connect = deny;
for (const name of ["node:http", "node:https"]) {
  const mod = require(name); mod.request = deny; mod.get = deny;
}
require("node:tls").connect = deny;
globalThis.fetch = async () => { throw new Error("DEMO MODE: outbound application networking is disabled."); };
console.info("DEMO MODE: outbound application networking disabled; browser-local simulation only.");
