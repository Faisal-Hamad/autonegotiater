import {migrateListingOwnership,type IntegrationState} from "./demo-integration";
// Browser-local synthetic demo data only. Never use this for real credentials or authorization.
export const storageVersion=4;
export function decodeLocal<T>(text:string,kind:string,validate:(value:unknown)=>value is T):T|null {
    try { if(text.length>12000000)return null;const data=JSON.parse(text);if(![3,storageVersion].includes(data.version)||data.kind!==kind||!validate(data.value))return null;return (kind==="autonegotiater-integration"||kind==="integration") ? migrateListingOwnership(data.value as IntegrationState) as T : data.value; } catch{return null;}
}
export function encodeLocal<T>(kind:string,value:T){return JSON.stringify({version:storageVersion,kind,value});}
export function safeTree(value:unknown):boolean{
    if(value===null||typeof value==="string"||typeof value==="boolean")return true;
    if(typeof value==="number")return Number.isFinite(value);
    if(Array.isArray(value))return value.length<=200000&&value.every(safeTree);
    return typeof value==="object"&&!!value&&Object.entries(value).every(([key,v])=>!/(password|token|secret|api.?key|__proto__|constructor|prototype)/i.test(key)&&safeTree(v));
}
