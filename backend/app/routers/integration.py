"""Authenticated persistence adapter for the approved multi-seller interface."""
import uuid
from typing import Literal
from copy import deepcopy
from decimal import Decimal
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy import Table,Column,String,BigInteger,ForeignKey,select,insert,update
from sqlalchemy.dialects.postgresql import JSONB
from app.db import Base,get_session
from app.models import User,Product,SellerRule,NegotiationSession,Offer,Deal,AuditLog
from app.integration_auth import current_user,public_user
from app.competitive_engine import create,step,buyer_view,cents,now
from app.product_identity import catalog_match_key
from app.routers.workspace import build_workspace_state
router=APIRouter(prefix="/integration",tags=["authenticated integration"])
records=Table("web_integration_records",Base.metadata,Column("id",String(100),primary_key=True),Column("kind",String(20),nullable=False),Column("owner_id",BigInteger,ForeignKey("users.id",ondelete="CASCADE"),nullable=False),Column("data",JSONB,nullable=False))
async def load(db,kind):return (await db.execute(select(records).where(records.c.kind==kind))).mappings().all()
async def catalog(db,private_owner=None):
    products=(await db.scalars(select(Product).order_by(Product.id))).all();users={u.id:u for u in (await db.scalars(select(User))).all()};rules={r.product_id:r for r in (await db.scalars(select(SellerRule))).all()};meta={r["data"]["productId"]:r["data"] for r in await load(db,"listing")};out=[]
    products_by_id={p.id:p for p in products}
    for p in products:
        m=meta.get(p.id,{});rule=rules.get(p.id);owner=users.get(p.seller_id)
        floor=max(float(p.min_acceptable_price),float(rule.min_price) if rule else 0,float(p.base_price)*(1-float(rule.max_discount if rule else 0)/100))
        item={"id":str(p.id),"productId":p.id,"catalogId":str(m.get("catalogId",p.id)),"matchKey":catalog_match_key(p,products_by_id,meta),"productName":p.name,"name":f"{owner.first_name} {owner.last_name}".strip() if owner else "Seller unavailable","sellerId":p.seller_id,"startingPrice":float(p.base_price),"stock":p.stock_quantity,"deliveryDays":m.get("deliveryDays"),"enabled":bool(owner and owner.is_active and m.get("enabled",True)),"maxRounds":min(12,rule.max_rounds if rule else 6),"concession":m.get("concession",round(float(p.base_price)*.04,2)),"strategy":m.get("strategy","competitive"),"description":p.description,"imageUrl":p.image_url}
        if private_owner==p.seller_id:item.update(minimumPrice=cents(floor,True)/100,declaredMinimumPrice=float(rule.min_price) if rule else float(p.min_acceptable_price),maximumDiscount=float(rule.max_discount) if rule else 0)
        product={"id":p.id,"seller_id":p.seller_id,"name":p.name,"description":p.description,"category":p.category,"base_price":str(p.base_price),"stock_quantity":p.stock_quantity,"image_url":p.image_url,"created_at":p.created_at.isoformat(),"catalog_id":item["catalogId"],"model_key":item["matchKey"]}
        out.append({"product":product,"listing":item})
    return out
@router.get("/catalog")
async def public_catalog(db=Depends(get_session)):return await catalog(db)
async def payload(db,user):
    uid=user["id"];role=user["role"];base=await build_workspace_state(db,viewer_id=uid);items=await catalog(db,uid if role=="seller" else None);attempts=sorted(await load(db,"attempt"),key=lambda row:row["data"]["createdAt"]);views=[];seller_views=[];ops=[];agreements=[];hidden_sessions=set()
    for rec in attempts:
        e=rec["data"];owned=uid==e["buyerId"] if role=="buyer" else any(s["sellerId"]==uid for s in e["sellers"]) if role=="seller" else role=="admin"
        if not owned:continue
        product=e["product"];rid=rec["id"];status="completed" if e["phase"]=="approved" else "awaiting_approval" if e["phase"]=="review" and any(s["status"]=="agreed" for s in e["sellers"]) else "failed" if e["phase"]=="review" else e["phase"] if e["phase"] in ("cancelled","rejected") else "paused" if e.get("paused") else "active"
        if role=="buyer":views.append({**buyer_view(e),"attemptId":rid})
        owned_sellers=[s for s in e["sellers"] if role!="seller" or s["sellerId"]==uid]
        for s in owned_sellers:
            if role!="seller":continue
            req={k:v for k,v in e["requirements"].items() if k!="maximumPrice"}
            seller_views.append({"id":rid+"--"+s["id"],"attemptId":rid,"productId":s.get("productId",product["id"]),"productName":s.get("productName",product["name"]),"catalogId":s.get("catalogId",e["catalogId"]),"buyerId":e["buyerId"],"sellerAccountId":uid,"storefrontId":s["id"],"storefrontKey":s["id"],"storefrontName":s["name"],"announcements":[m for m in s["history"] if m["agent"]=="Market update"],"approval":"pending" if e["phase"]!="approved" else "selected" if e.get("approvedSellerId")==s["id"] else "not_selected","requirements":req,"startingPrice":s["startingPrice"],"minimumPrice":s["minimumPrice"],"stock":s["stock"],"deliveryDays":s["deliveryDays"],"concession":s.get("concession",0),"round":e["round"],"maxRounds":e["requirements"]["maxRounds"],"phase":e["phase"],"status":s["status"],"reason":s["reason"],"currentPrice":s.get("currentPrice"),"agreedPrice":s.get("agreedPrice"),"history":s["history"],"anonymousBest":next((m["price"] for m in reversed(s["history"]) if m["agent"]=="Market update"),None)})
        if role=="seller" and e["phase"]=="approved" and not any(s["sellerId"]==uid and s["id"]==e.get("approvedSellerId") for s in e["sellers"]):status="not_selected"
        if role=="seller" and all(s["status"]=="excluded" for s in owned_sellers):status="excluded"
        participants=[{k:s[k] for k in ("id","sellerId","name","productId","productName","description","catalogId","startingPrice","currentPrice","agreedPrice","stock","deliveryDays","status","history") if k in s and s[k] is not None} for s in owned_sellers]
        ops.append({"id":rid,"type":"multi-seller","productName":product["name"],"buyerId":e["buyerId"],"sellerIds":sorted(set(s["sellerId"] for s in owned_sellers)),"status":status,"round":e["round"],"createdAt":e["createdAt"],"updatedAt":e["updatedAt"],"decisionAt":e.get("decisionAt"),"href":f"/dashboard/{role}/"+("competitive-session/" if role=="seller" else "competitive/")+rid,"product":product,"quantity":e["requirements"]["quantity"],"targetPrice":e["requirements"]["targetPrice"],"deliveryDays":e["requirements"]["deliveryDays"],"maxRounds":e["requirements"]["maxRounds"],"phase":e["phase"],"paused":e.get("paused",False),"participants":participants})
        if role=="seller" and owned_sellers:
            own_product=next((item["product"] for item in items if item["product"]["id"]==owned_sellers[0].get("productId")),product)
            ops[-1]["product"]=own_product;ops[-1]["productName"]=own_product["name"]
        agreement=e.get("agreement")
        if agreement:
            hidden_sessions.add(agreement["dbSessionId"])
            if role=="admin" or role=="buyer" and uid==agreement["buyerId"] or role=="seller" and uid==agreement["sellerId"]:agreements.append({k:v for k,v in agreement.items() if k!="dbSessionId"})
    seller_views=[{k:v for k,v in item.items() if v is not None} for item in seller_views]
    base["products"]=[item["product"] for item in items]
    base["sessions"]=[s for s in base["sessions"] if s["id"] not in hidden_sessions];base["deals"]=[d for d in base["deals"] if d["sessionId"] not in hidden_sessions]
    read_rec=(await db.execute(select(records.c.data).where(records.c.id=="read:"+str(uid)))).scalar_one_or_none();read_ids=(read_rec or {}).get("ids",[])
    for notice in base["notices"]:notice["read"]=notice["id"] in read_ids
    notifications=[{"id":"notice-"+r["id"]+"-"+r["status"],"userId":uid,"text":r["productName"]+": "+r["status"].replace("_"," "),"href":r["href"],"read":("notice-"+r["id"]+"-"+r["status"]) in read_ids,"createdAt":r["updatedAt"]} for r in ops]
    return {"user":user,"state":base,"catalog":items,"competitive":{"attempts":views,"sellerSessions":seller_views,"records":ops,"agreements":agreements,"notices":notifications}}
@router.get("/workspace")
async def workspace(user=Depends(current_user),db=Depends(get_session)):return await payload(db,user)
class Start(BaseModel):
    productId:int
    requirements:dict
    matchingPolicy:Literal["exact-catalog","model-storage-v1"]="exact-catalog"
@router.post("/attempts")
async def start(body:Start,user=Depends(current_user),db=Depends(get_session)):
    if user["role"]!="buyer":raise HTTPException(403,"Only a Buyer can start negotiations.")
    product=await db.get(Product,body.productId)
    if not product:raise HTTPException(404,"Product unavailable.")
    public=await catalog(db);chosen=next(x for x in public if x["product"]["id"]==product.id);key=chosen["listing"]["matchKey"] if body.matchingPolicy=="model-storage-v1" else chosen["listing"]["catalogId"];sources=[]
    for item in public:
        if (item["listing"]["matchKey"] if body.matchingPolicy=="model-storage-v1" else item["listing"]["catalogId"])!=key:continue
        p=await db.get(Product,item["product"]["id"]);rule=await db.scalar(select(SellerRule).where(SellerRule.product_id==p.id));floor=max(float(p.min_acceptable_price),float(rule.min_price) if rule else 0,float(p.base_price)*(1-float(rule.max_discount if rule else 0)/100))
        sources.append({**item["listing"],"minimumPrice":cents(floor,True)/100,"exactProduct":item["product"]["name"]==chosen["product"]["name"] and item["product"]["description"]==chosen["product"]["description"]})
    try:e=create(chosen["product"],user["id"],body.requirements,sources)
    except (ValueError,TypeError) as exc:raise HTTPException(400,str(exc))
    e["product"]=chosen["product"];e["catalogId"]=chosen["listing"]["catalogId"];e["matchKey"]=key if body.matchingPolicy=="model-storage-v1" else None;e["matchingPolicy"]=body.matchingPolicy;rid="NEG-"+uuid.uuid4().hex
    await db.execute(insert(records).values(id=rid,kind="attempt",owner_id=user["id"],data=e));db.add(AuditLog(user_id=user["id"],action="competitive_started",details={"attempt_id":rid}));await db.commit();return await payload(db,user)
class Action(BaseModel):
    action:str
    sellerId:str|None=None
@router.post("/attempts/{rid}")
async def action(rid:str,body:Action,user=Depends(current_user),db=Depends(get_session)):
    rec=(await db.execute(select(records).where(records.c.id==rid,records.c.kind=="attempt").with_for_update())).mappings().first()
    if not rec:raise HTTPException(404,"Session unavailable.")
    if user["role"]!="buyer" or rec["owner_id"]!=user["id"]:raise HTTPException(403,"Only the owning Buyer can act on this session.")
    e=deepcopy(rec["data"])
    if body.action=="advance":e=step(e)
    elif body.action=="archive":
        if e["phase"]=="running" or e["phase"]=="review" and any(s["status"]=="agreed" for s in e["sellers"]):raise HTTPException(409,"Cancel or finalize the current attempt first.")
        e["archived"]=True
    elif body.action in ("pause","resume"):
        if e["phase"]!="running":raise HTTPException(409,"This session is not running.")
        e["paused"]=body.action=="pause"
    elif body.action in ("cancel","reject"):
        if e["phase"] not in ("running","review"):raise HTTPException(409,"This session has ended.")
        if body.action=="reject" and e["phase"]!="review":raise HTTPException(409,"Wait for the final offers before rejecting.")
        e["phase"]="cancelled" if body.action=="cancel" else "rejected";e["decisionAt"]=now()
    elif body.action=="approve":
        if e["phase"]=="approved":return await payload(db,user)
        if e["phase"]!="review":raise HTTPException(409,"Complete negotiation before approval.")
        s=next((s for s in e["sellers"] if s["id"]==body.sellerId and s["status"]=="agreed"),None)
        if not s:raise HTTPException(400,"Select an eligible mutually accepted offer.")
        p=await db.scalar(select(Product).where(Product.id==s["productId"]).with_for_update());rule=await db.scalar(select(SellerRule).where(SellerRule.product_id==p.id)) if p else None
        seller=await db.get(User,s["sellerId"]);latest=next((x["listing"] for x in await catalog(db,s["sellerId"]) if x["product"]["id"]==s["productId"]),None);price=s["agreedPrice"];r=e["requirements"]
        if not p or not seller or not seller.is_active or p.stock_quantity<r["quantity"] or not latest or not latest["enabled"] or (latest["matchKey"]!=e["matchKey"] if e.get("matchKey") else latest["catalogId"]!=e["catalogId"]) or (s.get("productName") is not None and (p.name!=s["productName"] or p.description!=s.get("description"))) or not latest["deliveryDays"] or latest["deliveryDays"]>r["deliveryDays"] or not max(s["minimumPrice"],latest["minimumPrice"])<=price<=r["maximumPrice"] or not s["history"] or s["history"][-1]["action"]!="accept" or s["history"][-1]["price"]!=price:raise HTTPException(409,"Listing availability or terms changed. Start another negotiation.")
        canonical=NegotiationSession(buyer_id=user["id"],product_id=p.id,status="completed",mode="semi_automated",max_budget=Decimal(str(r["maximumPrice"])),round_count=e["round"])
        db.add(canonical);await db.flush();p.stock_quantity-=r["quantity"]
        for m in s["history"]:
            if m["agent"] not in ("Buyer Agent","Seller Agent"):continue
            db.add(Offer(session_id=canonical.id,offered_by="buyer" if m["agent"]=="Buyer Agent" else "seller",price=Decimal(str(m["price"])),conditions={"action":m["action"],"message":m["explanation"],"quantity":r["quantity"]},status="accepted" if m["action"]=="accept" else "countered",round_number=m["round"]))
        deal=Deal(session_id=canonical.id,final_price=Decimal(str(price)),final_conditions={"quantity":r["quantity"],"delivery_days":s["deliveryDays"],"total":round(price*r["quantity"],2),"integration_attempt":rid,"product_name":p.name,"product_description":p.description},closed_by="buyer",payment_status="pending");db.add(deal);await db.flush()
        e["phase"]="approved";e["approvedSellerId"]=s["id"];e["decisionAt"]=now()
        e["agreement"]={"id":"AGR-"+str(deal.id),"dbSessionId":canonical.id,"sessionId":rid,"buyerId":user["id"],"sellerId":s["sellerId"],"listingId":s["id"],"catalogProductId":latest["catalogId"],"storefrontId":s["id"],"storefrontName":s["name"],"productId":p.id,"productName":p.name,"productDescription":p.description,"requestedProductId":e["productId"],"requestedProductName":e["productName"],"quantity":r["quantity"],"unitPrice":price,"total":round(price*r["quantity"],2),"deliveryDays":s["deliveryDays"],"status":"RECORDED","createdAt":now(),"approvedAt":now()}
    else:raise HTTPException(400,"Unsupported action.")
    e["updatedAt"]=now();await db.execute(update(records).where(records.c.id==rid).values(data=e));db.add(AuditLog(user_id=user["id"],action="competitive_"+body.action,details={"attempt_id":rid}));await db.commit();return await payload(db,user)
class Listing(BaseModel):
    catalogProductId:int
    productId:int|None=None
    listing:dict
@router.post("/listings")
async def save_listing(body:Listing,user=Depends(current_user),db=Depends(get_session)):
    if user["role"]!="seller":raise HTTPException(403,"Seller access required.")
    source=await db.get(Product,body.catalogProductId)
    if not source:raise HTTPException(404,"Catalog product unavailable.")
    p=await db.scalar(select(Product).where(Product.id==body.productId).with_for_update()) if body.productId else None
    if body.productId and (not p or p.seller_id!=user["id"]):raise HTTPException(403,"This listing is not owned by you.")
    if p and source.id!=p.id and (source.name!=p.name or source.category!=p.category):raise HTTPException(400,"Select the exact catalog product; unrelated listings cannot be matched.")
    v=body.listing
    try:
        opening=cents(v["startingPrice"]);minimum=cents(v.get("declaredMinimumPrice",v["minimumPrice"]),True);discount=float(v.get("maximumDiscount",0));stock=v["stock"];delivery=v["deliveryDays"];rounds=v.get("maxRounds",6);concession=cents(v["concession"])
        assert 0<minimum<=opening<=100000000 and 0<=discount<=100 and type(stock) is int and 0<=stock<=10000 and type(delivery) is int and 1<=delivery<=365 and type(rounds) is int and 1<=rounds<=12 and concession>0
    except (KeyError,ValueError,TypeError,AssertionError):raise HTTPException(400,"Check price boundaries, whole stock, delivery and round limits.")
    image=v.get("imageUrl") or None
    if image and ((not image.startswith("/media/") and not image.startswith("https://")) or ".." in image or "@" in image):raise HTTPException(400,"Use a local /media/ image path.")
    if not p:
        p=Product(seller_id=user["id"],name=source.name,category=source.category,description=source.description,base_price=Decimal(opening)/100,min_acceptable_price=Decimal(minimum)/100,stock_quantity=stock,image_url=image);db.add(p);await db.flush()
    p.base_price=Decimal(opening)/100;p.min_acceptable_price=Decimal(minimum)/100;p.stock_quantity=stock;p.description=str(v.get("description",p.description) or "")[:3000];p.image_url=image
    rule=await db.scalar(select(SellerRule).where(SellerRule.product_id==p.id))
    if not rule:rule=SellerRule(seller_id=user["id"],product_id=p.id);db.add(rule)
    rule.min_price=p.min_acceptable_price;rule.max_discount=Decimal(str(discount));rule.max_rounds=rounds;rule.auto_accept_threshold=p.base_price
    all_public=await catalog(db);source_key=next(x["listing"]["catalogId"] for x in all_public if x["product"]["id"]==source.id)
    key="listing:"+str(p.id);meta={"productId":p.id,"catalogId":source_key,"deliveryDays":delivery,"concession":concession/100,"strategy":v.get("strategy","competitive"),"enabled":v.get("enabled") is True}
    existing=await db.scalar(select(records.c.id).where(records.c.id==key))
    if existing:await db.execute(update(records).where(records.c.id==key).values(data=meta))
    else:await db.execute(insert(records).values(id=key,kind="listing",owner_id=user["id"],data=meta))
    db.add(AuditLog(user_id=user["id"],action="listing_settings_saved",details={"product_id":p.id}));await db.commit();return await payload(db,user)

class Change(BaseModel):
    kind:str
    reference:int=0
    data:dict
@router.post("/changes")
async def change(body:Change,user=Depends(current_user),db=Depends(get_session)):
    from app.routers import workspace as old
    uid=user["id"];d=body.data
    if body.kind=="product":
        if user["role"]!="seller":raise HTTPException(403,"Seller access required.")
        if cents(d.get("base_price",0))<=0 or type(d.get("stock_quantity")) is not int or d["stock_quantity"]<0:raise HTTPException(400,"Check public price and stock.")
        v=old.ProductPayload(seller_id=uid,name=d["name"],category=d["category"],base_price=d["base_price"],stock_quantity=d["stock_quantity"],description=d.get("description"),image_url=d.get("image_url"))
        if body.reference:await old.update_product(body.reference,v,str(uid),db)
        else:await old.create_product(v,str(uid),db)
    elif body.kind=="rules":
        if user["role"]!="seller":raise HTTPException(403,"Seller access required.")
        p=await db.get(Product,body.reference)
        if not p or p.seller_id!=uid:raise HTTPException(403,"Only your own listing may be changed.")
        if not 0<float(d["minimum"])<=float(d["threshold"])<=float(p.base_price) or not 0<=float(d["discount"])<=100 or type(d["rounds"]) is not int or not 1<=d["rounds"]<=12:raise HTTPException(400,"Check the private floor, threshold, discount and round limits.")
        await old.update_product_rules(body.reference,old.RulesPayload(seller_id=uid,**d),str(uid),db)
    elif body.kind=="rating":
        if user["role"]!="buyer":raise HTTPException(403,"Buyer access required.")
        await old.save_deal_rating(body.reference,old.RatingPayload(buyer_id=uid,rating=d["rating"],feedback=d.get("feedback","")),str(uid),db)
    elif body.kind=="account_status":
        if user["role"]!="admin" or body.reference==uid:raise HTTPException(403,"Admin access required; you cannot suspend yourself.")
        if type(d.get("active")) is not bool:raise HTTPException(400,"Invalid account status.")
        await old.update_user_status(body.reference,old.UserStatusPayload(active=d["active"]),str(uid),db)
    elif body.kind=="notices":
        key="read:"+str(uid);existing=await db.scalar(select(records.c.id).where(records.c.id==key));value={"ids":d.get("ids",[])}
        if existing:await db.execute(update(records).where(records.c.id==key).values(data=value))
        else:await db.execute(insert(records).values(id=key,kind="read",owner_id=uid,data=value))
        await db.commit()
    else:raise HTTPException(400,"Unsupported workspace change.")
    return await payload(db,user)
