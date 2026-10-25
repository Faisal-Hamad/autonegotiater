import type { Product } from "./api";
import type { DemoUser, DemoViewState } from "./demo-model";
import { catalogIdentity, inventoryFor, createCompetitiveSession, advanceCompetitiveStep, approveCompetitiveOffer, competitiveView, rankedOffers, type Inventory, type CompetitiveSession, validateRequirements, type Requirements } from "./competitive";
export type Attempt = { id: string; createdAt: string; updatedAt: string; decisionAt?: string; paused: boolean; archived: boolean; product: Product; engine: CompetitiveSession };
export type DemoAgreement = { id: string; sessionId: string; buyerId: number; sellerId: number; listingId?: string; catalogProductId?: string; storefrontId: string; storefrontName: string; productId: number; productName: string; quantity: number; unitPrice: number; total: number; deliveryDays: number; status: "DEMO_RECORDED"; createdAt: string; approvedAt: string };
export type DemoEvent = { id: string; userId: number; text: string; href: string; read: boolean; createdAt: string };
export type DemoAudit = { id: string; action: string; reference: string; time: string };
export type IntegrationState = { attempts: Attempt[]; agreements: DemoAgreement[]; notices: DemoEvent[]; audit: DemoAudit[]; listingCatalog?: Record<string, Inventory>; customListings?: Record<string, Inventory>; settings: Record<string, Inventory>; storefrontNames: Record<string, string>; sequence: number };
export const emptyIntegration = (): IntegrationState => ({ attempts: [], agreements: [], notices: [], audit: [], listingCatalog: {}, customListings: {}, settings: {}, storefrontNames: {}, sequence: 0 });
export function ownedAttempt(a: Attempt, user: DemoUser) { return user.active && (user.role === "admin" || user.role === "buyer" && a.engine.buyerId === user.id || user.role === "seller" && a.engine.sellers.some(s=>s.sellerAccountId===user.id && s.inventory.ownerSellerId===user.id)); }
export function attemptStatus(a: Attempt,user?:DemoUser): string { if(user?.role==="seller"){const own=a.engine.sellers.filter(s=>s.sellerAccountId===user.id&&s.inventory.ownerSellerId===user.id);if(a.engine.phase==="approved")return a.engine.sellers.some(s=>s.inventory.id===a.engine.approvedSellerId&&s.sellerAccountId===user.id)?"completed":"not_selected";if(!["cancelled","rejected"].includes(a.engine.phase)&&own.length&&own.every(s=>s.status==="excluded"))return "excluded";if(a.engine.phase==="review"&&!own.some(s=>s.status==="agreed"))return "failed";} return a.engine.phase === "approved" ? "completed" : a.engine.phase === "cancelled" ? "cancelled" : a.engine.phase === "rejected" ? "rejected" : a.engine.phase === "review" ? rankedOffers(competitiveView(a.engine,a.engine.buyerId)!).length ? "awaiting_approval" : "failed" : a.paused ? "paused" : "active"; }
export function configuredListings(state: IntegrationState, product: Product, users: DemoUser[], rules: DemoViewState["rules"] = []): Inventory[] {
    return [...inventoryFor(product),...Object.entries(state.customListings??{}).filter(([key])=>key.startsWith(`${product.id}:`)).map(([,listing])=>listing)].map(generated=>{
        const primary=generated.id==="riyadh"||generated.id===`p${product.id}-listing`;
        const base=primary?generated:state.listingCatalog?.[`${product.id}:${generated.id}`]??generated;
        const saved=state.settings[`${product.id}:${base.id}`];
        const rule=base.id===`p${product.id}-listing` || base.id==="riyadh" ? rules.find(r=>r.productId===product.id) : undefined;
        const own=saved && saved.ownerSellerId===base.ownerSellerId && saved.storefrontKey===base.storefrontKey && saved.productKey===base.productKey ? { ...base,...saved } : rule ? { ...base, minimumPrice:Math.max(rule.minimum,Math.ceil(base.startingPrice*(1-rule.discount/100)*100-1e-7)/100),enabled:rule.enabled,maxRounds:Math.min(12,rule.rounds) } : base;
        return { ...own, name:state.storefrontNames[own.storefrontKey] ?? own.name, enabled:own.enabled!==false && users.some(u=>u.id===own.ownerSellerId && u.active && u.role==="seller") };
    });
}
export function validateListing(i: Inventory) {
    return !!i.id && !!i.storefrontKey && Number.isInteger(i.ownerSellerId) && i.ownerSellerId>0 && !!i.productKey && !!i.name.trim() && [i.startingPrice,i.minimumPrice,i.concession].every(v=>Number.isFinite(v)&&v>=.01&&v<=1000000&&Math.abs(v*100-Math.round(v*100))<.000001) && i.minimumPrice<=i.startingPrice && (i.declaredMinimumPrice===undefined||Number.isFinite(i.declaredMinimumPrice)&&i.declaredMinimumPrice>0&&i.declaredMinimumPrice<=i.minimumPrice) && (i.maximumDiscount===undefined||Number.isFinite(i.maximumDiscount)&&i.maximumDiscount>=0&&i.maximumDiscount<=100&&i.minimumPrice+1e-7>=Math.ceil(i.startingPrice*(1-i.maximumDiscount/100)*100-1e-7)/100) && (i.description===undefined||typeof i.description==="string"&&i.description.length<=3000) && (i.imageUrl===undefined||typeof i.imageUrl==="string"&&(!i.imageUrl||/^\/(?!\/)/.test(i.imageUrl))) && Number.isInteger(i.stock)&&i.stock>=0&&i.stock<=10000 && Number.isInteger(i.deliveryDays)&&i.deliveryDays>=1&&i.deliveryDays<=365 && Number.isInteger(i.maxRounds ?? 6)&&(i.maxRounds ?? 6)>=1&&(i.maxRounds ?? 6)<=12 && ["steady","competitive"].includes(i.strategy ?? "competitive") && typeof(i.enabled ?? true)==="boolean";
}
function event(state: IntegrationState, userId: number, text: string, href: string, now: string) { state.notices.unshift({ id:`event-${++state.sequence}`,userId,text,href,read:false,createdAt:now }); }
function audit(state: IntegrationState, action: string, reference: string, now: string) { state.audit.unshift({id:`audit-${++state.sequence}`,action,reference,time:now}); }
function notifyAttempt(state: IntegrationState,a:Attempt,text:string,now:string) {
    event(state,a.engine.buyerId,text,`/dashboard/buyer/competitive/${a.id}`,now);
    for(const sellerId of new Set(a.engine.sellers.map(s=>s.sellerAccountId))) event(state,sellerId,text,`/dashboard/seller/competitive-session/${a.id}`,now);
}
export type IntegrationAction = { type:"start"; product:Product; requirements:Requirements; listings:Inventory[] } | {type:"step"|"pause"|"resume"|"cancel"|"reject"|"archive";id:string} | {type:"approve";id:string;sellerId:string} | {type:"settings";productId:number;listing:Inventory;storefrontName:string} | {type:"listing_create";productId:number;listing:Inventory} | {type:"read";id?:string};
export function transition(state:IntegrationState,user:DemoUser,action:IntegrationAction,now:string):IntegrationState {
    if(!user.active)return state;
    const next=structuredClone(state);
    if(action.type==="read"){next.notices=next.notices.map(n=>n.userId===user.id&&(!action.id||n.id===action.id)?{...n,read:true}:n);return next;}
    if(action.type==="listing_create"){
        if(user.role!=="seller"||action.listing.ownerSellerId!==user.id||!validateListing(action.listing)||!Number.isSafeInteger(action.productId)||action.productId<1||action.listing.productKey!==catalogIdentity(action.productId))return state;
        const number=++next.sequence,id=`local-listing-${number}`;
        (next.customListings??={})[`${action.productId}:${id}`]={...structuredClone(action.listing),id,storefrontKey:`listing-${user.id}-${number}`};
        audit(next,"seller_listing_created",`${action.productId}:${id}`,now);return next;
    }
    if(action.type==="settings"){
        if(user.role!=="seller"||action.listing.ownerSellerId!==user.id||!validateListing(action.listing)||!action.storefrontName.trim())return state;
        const key=`${action.productId}:${action.listing.id}`,previous=state.settings[key];
        if(previous && (previous.ownerSellerId!==user.id||previous.storefrontKey!==action.listing.storefrontKey))return state;
        next.settings[key]=structuredClone(action.listing);next.storefrontNames[action.listing.storefrontKey]=action.storefrontName.trim().slice(0,100);audit(next,"seller_settings_saved",key,now);return next;
    }
    if(action.type==="start"){
        if(user.role!=="buyer"||action.listings.some(i=>!validateListing(i))||new Set(action.listings.map(i=>i.id)).size!==action.listings.length)return state;
        const active=state.attempts.find(a=>!a.archived&&a.engine.buyerId===user.id&&a.engine.productId===action.product.id&&["active","paused","awaiting_approval"].includes(attemptStatus(a)));if(active)return state;
        const a:Attempt={id:`competitive-${++next.sequence}`,createdAt:now,updatedAt:now,paused:false,archived:false,product:structuredClone(action.product),engine:createCompetitiveSession(action.requirements,user.id,action.product,action.listings)};
        next.attempts.unshift(a);audit(next,"negotiation_created",a.id,now);notifyAttempt(next,a,"Competitive negotiation started. Open your scoped session.",now);return next;
    }
    const a=next.attempts.find(a=>a.id===action.id);
    if(!a||user.role!=="buyer"||a.engine.buyerId!==user.id)return state;
    if(action.type==="archive"){
        if(["active","paused","awaiting_approval"].includes(attemptStatus(a)))return state;a.archived=true;a.updatedAt=now;audit(next,"attempt_archived",a.id,now);return next;
    }
    if(action.type==="pause"||action.type==="resume"){
        if(a.engine.phase!=="running")return state;a.paused=action.type==="pause";a.updatedAt=now;audit(next,`negotiation_${action.type}`,a.id,now);return next;
    }
    if(action.type==="cancel"||action.type==="reject"){
        if(action.type==="reject"?a.engine.phase!=="review":!["running","review"].includes(a.engine.phase))return state;
        a.engine.phase=action.type==="reject"?"rejected":"cancelled";a.engine.pending=undefined;a.decisionAt=now;a.updatedAt=now;a.paused=true;
        audit(next,`buyer_${action.type}`,a.id,now);notifyAttempt(next,a,action.type==="reject"?"Buyer rejected all offers. No Agreement recorded.":"Buyer cancelled negotiation. No Agreement recorded.",now);return next;
    }
    if(action.type==="step"){
        if(a.engine.phase!=="running")return state;
        const old=a.engine,updated=advanceCompetitiveStep(old);
        for(const seller of updated.sellers){const previous=old.sellers.find(s=>s.inventory.id===seller.inventory.id);seller.history.forEach((m,index)=>{m.timestamp=previous?.history[index]?.timestamp??m.timestamp??now;});}
        a.engine=updated;a.updatedAt=now;
        audit(next,"negotiation_advanced",a.id,now);
        for(const s of updated.sellers){const oldS=old.sellers.find(o=>o.inventory.id===s.inventory.id);if(s.status==="agreed"&&oldS?.status!=="agreed"){
            event(next,s.sellerAccountId,"Your agents reached a provisional Agreement.",`/dashboard/seller/competitive-session/${a.id}`,now);event(next,updated.buyerId,"Agents reached a provisional Agreement.",`/dashboard/buyer/competitive/${a.id}`,now);audit(next,"agent_agreement",a.id,now);
        }}
        if(old.phase!==updated.phase)notifyAttempt(next,a,attemptStatus(a)==="failed"?"Negotiation ended without an eligible Agreement.":"Negotiation completed. Buyer final review is required.",now);
        return next;
    }
    if(action.type==="approve"){
        if(next.agreements.some(g=>g.sessionId===a.id))return state;
        const approved=approveCompetitiveOffer(a.engine,action.sellerId,user.id);if(approved===a.engine)return state;
        const seller=approved.sellers.find(s=>s.inventory.id===action.sellerId)!;a.engine=approved;a.decisionAt=now;a.updatedAt=now;
        const g:DemoAgreement={id:`agreement-${++next.sequence}`,sessionId:a.id,buyerId:user.id,sellerId:seller.sellerAccountId,listingId:seller.inventory.id,catalogProductId:approved.catalogId,storefrontId:seller.inventory.storefrontKey,storefrontName:seller.inventory.name,productId:approved.productId,productName:approved.productName,quantity:approved.requirements.quantity,unitPrice:seller.agreedPrice!,total:Math.round(seller.agreedPrice!*approved.requirements.quantity*100)/100,deliveryDays:seller.inventory.deliveryDays,status:"DEMO_RECORDED",createdAt:now,approvedAt:now};
        next.agreements.unshift(g);audit(next,"buyer_approved",a.id,now);audit(next,"demo_agreement_recorded",g.id,now);
        event(next,user.id,"Your DEMO Agreement was recorded. No payment, stock reservation or shipment.",`/dashboard/buyer/agreements/${g.id}`,now);
        for(const owner of new Set(approved.sellers.map(s=>s.sellerAccountId)))event(next,owner,owner===g.sellerId?"Your product listing was selected. A DEMO Agreement was recorded.":"Buyer selected another Seller. No sale was recorded for you.",owner===g.sellerId?`/dashboard/seller/agreements/${g.id}`:`/dashboard/seller/competitive-session/${a.id}`,now);
        return next;
    }
    return state;
}
export type SessionRead = {id:string;type:"one-to-one"|"multi-seller";productName:string;buyerId:number;sellerIds:number[];status:string;round:number;createdAt:string;href:string};
export function unifiedSessions(legacy:DemoViewState,attempts:Attempt[],user:DemoUser):SessionRead[]{
    if(!user.active)return [];
    return [...legacy.sessions.map(s=>({id:`legacy-${s.id}`,type:"one-to-one" as const,productName:legacy.products.find(p=>p.id===s.productId)?.name??"Unavailable product",buyerId:s.buyerId,sellerIds:[legacy.products.find(p=>p.id===s.productId)?.seller_id??0],status:s.status,round:Math.max(0,...s.rounds.map(r=>r.number)),createdAt:s.createdAt,href:`/dashboard/${user.role}/negotiations/${s.id}`})),...attempts.filter(a=>ownedAttempt(a,user)).map(a=>({id:a.id,type:"multi-seller" as const,productName:a.engine.productName,buyerId:a.engine.buyerId,sellerIds:user.role==="seller"?[user.id]:[...new Set(a.engine.sellers.filter(s=>s.status!=="excluded").map(s=>s.sellerAccountId))],status:attemptStatus(a,user),round:a.engine.round,createdAt:a.createdAt,href:`/dashboard/${user.role}/${user.role==="seller"?"competitive-session":"competitive"}/${a.id}`}))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}

export function validateIntegration(value:unknown):value is IntegrationState {
    try {
        const s=value as IntegrationState;
        if(!s||![s.attempts,s.agreements,s.notices,s.audit].every(Array.isArray)||!s.settings||!s.storefrontNames||!Number.isSafeInteger(s.sequence)||s.sequence<0)return false;
        const timestamp=(v:string)=>typeof v==="string"&&Number.isFinite(Date.parse(v));
        function engine(e:CompetitiveSession,depth=0):boolean {
            if(!e||depth>1||validateRequirements(e.requirements)||!Number.isSafeInteger(e.buyerId)||e.buyerId<1||!Number.isSafeInteger(e.productId)||e.productId<1||!Array.isArray(e.sellers)||!Array.isArray(e.announcements)||!Number.isInteger(e.round)||e.round<0||e.round>e.requirements.maxRounds||!["running","review","approved","rejected","cancelled"].includes(e.phase))return false;
            if(!e.sellers.every(x=>x.sellerAccountId===x.inventory.ownerSellerId&&x.inventory.productKey===e.catalogId&&validateListing(x.inventory)&&["negotiating","agreed","rejected","excluded"].includes(x.status)&&Array.isArray(x.history)&&x.history.every(m=>["Buyer Agent","Seller Agent","Market update"].includes(m.agent)&&["offer","counteroffer","accept","decline","announcement"].includes(m.action)&&Number.isInteger(m.round)&&m.round>=1&&m.round<=e.round&&typeof m.explanation==="string"&&(m.timestamp===undefined||timestamp(m.timestamp))&&(m.price===undefined||Number.isFinite(m.price)&&m.price>0&&(m.agent!=="Buyer Agent"||m.price<=e.requirements.maximumPrice)&&(m.agent!=="Seller Agent"||m.price>=x.inventory.minimumPrice)))))return false;
            if(e.sellers.some(x=>(x.currentPrice!==undefined&&(!Number.isFinite(x.currentPrice)||x.currentPrice<x.inventory.minimumPrice||x.currentPrice>x.inventory.startingPrice))||(x.agreedPrice!==undefined&&(x.status!=="agreed"||x.agreedPrice!==x.currentPrice||x.agreedPrice>e.requirements.maximumPrice||x.inventory.stock<e.requirements.quantity||x.inventory.deliveryDays>e.requirements.deliveryDays||!x.history.slice(-2).every(m=>m.action==="accept"&&m.price===x.agreedPrice)||x.history.slice(-2).length!==2))))return false;
            if(e.pending&&(!engine(e.pending.target,depth+1)||e.pending.target.buyerId!==e.buyerId||e.pending.target.productId!==e.productId||JSON.stringify(e.pending.target.requirements)!==JSON.stringify(e.requirements)||!Array.isArray(e.pending.events)||!Number.isInteger(e.pending.index)||e.pending.index<0||e.pending.index>=e.pending.events.length||!e.pending.events.every(x=>e.sellers.some(s=>s.inventory.id===x.sellerId)&&x.message&&typeof x.message.explanation==="string")))return false;
            return true;
        }
        if(!s.attempts.every(a=>typeof a.id==="string"&&timestamp(a.createdAt)&&timestamp(a.updatedAt)&&typeof a.paused==="boolean"&&typeof a.archived==="boolean"&&a.product?.id===a.engine.productId&&engine(a.engine)))return false;
        if([s.attempts,s.agreements,s.notices,s.audit].some(rows=>new Set(rows.map(a=>a.id)).size!==rows.length)||new Set(s.agreements.map(a=>a.sessionId)).size!==s.agreements.length)return false;
        if([...s.attempts,...s.agreements,...s.notices,...s.audit].some(x=>Number(x.id.split("-").at(-1))>s.sequence))return false;
        if(s.attempts.some(a=>a.engine.phase==="approved"&&!s.agreements.some(g=>g.sessionId===a.id)))return false;
        if(!Object.values(s.listingCatalog??{}).every(validateListing)||!Object.entries(s.customListings??{}).every(([key,l])=>/^\d+:local-listing-\d+$/.test(key)&&key.endsWith(`:${l.id}`)&&l.productKey===catalogIdentity(Number(key.split(":")[0]))&&validateListing(l))||!Object.values(s.settings).every(validateListing)||!Object.values(s.storefrontNames).every(n=>typeof n==="string"&&n.length<=100))return false;
        if(!s.agreements.every(g=>{const a=s.attempts.find(a=>a.id===g.sessionId);const seller=a?.engine.sellers.find(x=>x.inventory.id===a.engine.approvedSellerId);return a?.engine.phase==="approved"&&seller&&g.buyerId===a.engine.buyerId&&g.sellerId===seller.sellerAccountId&&(g.listingId===undefined||g.listingId===seller.inventory.id)&&(g.catalogProductId===undefined||g.catalogProductId===a.engine.catalogId)&&g.unitPrice===seller.agreedPrice&&g.total===Math.round(g.unitPrice*g.quantity*100)/100&&g.quantity===a.engine.requirements.quantity&&g.status==="DEMO_RECORDED"&&timestamp(g.createdAt)&&timestamp(g.approvedAt);} ))return false;
        return s.notices.every(n=>typeof n.id==="string"&&Number.isInteger(n.userId)&&typeof n.text==="string"&&typeof n.read==="boolean"&&typeof n.href==="string"&&n.href.startsWith("/")&&!n.href.startsWith("//")&&timestamp(n.createdAt))&&s.audit.every(a=>typeof a.id==="string"&&typeof a.action==="string"&&timestamp(a.time));
    }catch{return false;}
}

/** Additive v3 -> v4 migration: never rewrite historical engines, messages or identifiers. */
export function migrateListingOwnership(value:IntegrationState):IntegrationState{
    const next=structuredClone(value);next.customListings??={};
    for(const g of next.agreements){const a=next.attempts.find(a=>a.id===g.sessionId);const winner=a?.engine.sellers.find(s=>s.inventory.id===a.engine.approvedSellerId);if(winner){g.listingId??=winner.inventory.id;g.catalogProductId??=a!.engine.catalogId;}}
    return next;
}

/** Freeze generated alternative listings once, so changing one Seller's catalog reference price cannot reprice other Sellers. */
export function materializeListingCatalog(state:IntegrationState,products:Product[]):IntegrationState{
    let next=state;
    for(const p of products)for(const listing of inventoryFor(p)){const key=`${p.id}:${listing.id}`;if(!next.listingCatalog?.[key]){if(next===state)next={...state,listingCatalog:{...state.listingCatalog}};next.listingCatalog![key]=structuredClone(listing);}}
    return next;
}
