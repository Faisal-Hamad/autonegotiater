"""Runs ONLY in the disposable staging database. Never target production."""
import asyncio,json,urllib.request,urllib.error,http.cookiejar,os,secrets
from decimal import Decimal
from app.db import SessionLocal,engine
from app.models import User,Product,SellerRule,Deal
from app.security import hash_password
from sqlalchemy import select,func
from app.config import settings
assert "autoneg_integration_stage" in settings.database_url and "stage-db" in settings.database_url,"Refusing non-staging database"
BASE="http://127.0.0.1:8000";ORIGIN="http://127.0.0.1:33327";password=secrets.token_urlsafe(20);ids={};checks=0
async def fixture():
    async with SessionLocal() as db:
        assert not await db.scalar(select(func.count(User.id))),"Stage fixture database is not empty"
        for name,role in [("buyer","buyer"),("other","buyer"),("seller1","seller"),("seller2","seller"),("seller3","seller"),("admin","admin")]:
            u=User(first_name="STAGING",last_name=name,email=name+"@integration.invalid",password_hash=hash_password(password),role=role,is_active=True);db.add(u);await db.flush();ids[name]=u.id
        for index,start,floor,stock in [(1,4700,4050,25),(2,4550,3980,18),(3,4600,4100,12)]:
            p=Product(seller_id=ids["seller"+str(index)],name="STAGING Exact Laptop",category="Electronics",description="Synthetic staging fixture, not production data",base_price=Decimal(start),min_acceptable_price=Decimal(floor),stock_quantity=stock);db.add(p);await db.flush();ids["product"+str(index)]=p.id;db.add(SellerRule(seller_id=p.seller_id,product_id=p.id,min_price=p.min_acceptable_price,max_discount=Decimal(30),max_rounds=6,auto_accept_threshold=p.base_price))
        await db.commit()
    await engine.dispose()
asyncio.run(fixture())
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(c,path,body=None,status=200,headers=None):
    global checks
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers={"Content-Type":"application/json","Origin":ORIGIN,**(headers or {})})
    try:
        r=c.open(req,timeout=20);code=r.status;data=json.load(r)
    except urllib.error.HTTPError as error:code=error.code;data=json.load(error)
    assert code==status,(path,code,data)
    checks+=1;return data
anon=client();call(anon,"/integration/workspace",status=401);call(anon,"/workspace/bootstrap?viewer_id="+str(ids["admin"]),status=401,headers={"X-Viewer-Id":str(ids["admin"])})
clients={}
for name in ids:
    if name.startswith("product"):continue
    c=client();call(c,"/auth/login",{"email":name+"@integration.invalid","password":password});clients[name]=c
for index in (1,2,3):
    c=clients["seller"+str(index)];p=ids["product"+str(index)]
    call(c,"/integration/listings",{"catalogProductId":ids["product1"],"productId":p,"listing":{"startingPrice":[4700,4550,4600][index-1],"minimumPrice":[4050,3980,4100][index-1],"declaredMinimumPrice":[4050,3980,4100][index-1],"maximumDiscount":30,"stock":[25,18,12][index-1],"deliveryDays":[5,6,9][index-1],"concession":150,"maxRounds":6,"enabled":True,"strategy":"competitive"}})
public=call(anon,"/integration/catalog");assert len({x["listing"]["catalogId"] for x in public})==1;assert "minimumPrice" not in json.dumps(public)
call(clients["buyer"],"/dashboard/admin",status=403)
call(clients["seller2"],"/integration/listings",{"catalogProductId":ids["product1"],"productId":ids["product1"],"listing":{}},status=403)
call(clients["buyer"],"/integration/changes",{"kind":"account_status","reference":ids["admin"],"data":{"active":False}},status=403)
requirements={"quantity":10,"targetPrice":4000,"maximumPrice":4300,"deliveryDays":7,"maxRounds":6}
def start(r=None):
    v=call(clients["buyer"],"/integration/attempts",{"productId":ids["product1"],"requirements":r or requirements});return v["competitive"]["attempts"][-1]["attemptId"]
def attempt(v,rid):return next(a for a in v["competitive"]["attempts"] if a["attemptId"]==rid)
rid=start();call(clients["other"],"/integration/attempts/"+rid,{"action":"advance"},status=403,headers={"X-Viewer-Id":str(ids["buyer"])})
for _ in range(12):
    v=call(clients["buyer"],"/integration/attempts/"+rid,{"action":"advance"});a=attempt(v,rid)
    if a["phase"]=="review":break
assert a["phase"]=="review";assert a["sellers"][2]["status"]=="excluded";assert "minimumPrice" not in json.dumps(a);assert "privateLimits" not in json.dumps(a)
agreed=[s for s in a["sellers"] if s["status"]=="agreed"];assert len(agreed)>=2;chosen=min(agreed,key=lambda x:x["agreedPrice"])
sv=call(clients["seller1"],"/integration/workspace");assert all(s["sellerAccountId"]==ids["seller1"] for s in sv["competitive"]["sellerSessions"]);assert "maximumPrice" not in json.dumps(sv);assert all(not r["participants"] or all(p["sellerId"]==ids["seller1"] for p in r["participants"]) for r in sv["competitive"]["records"])
assert any(m["agent"]=="Market update" for s in a["sellers"] for m in s["history"])
v=call(clients["buyer"],"/integration/attempts/"+rid,{"action":"approve","sellerId":chosen["id"]});assert attempt(v,rid)["phase"]=="approved";assert len(v["competitive"]["agreements"])==1
v=call(clients["buyer"],"/integration/attempts/"+rid,{"action":"approve","sellerId":chosen["id"]});assert len(v["competitive"]["agreements"])==1
assert len(call(clients["buyer"],"/integration/workspace")["competitive"]["agreements"])==1
for decision in ("cancel","reject"):
    rid=start({**requirements,"quantity":1})
    if decision=="reject":
        for _ in range(12):
            v=call(clients["buyer"],"/integration/attempts/"+rid,{"action":"advance"})
            if attempt(v,rid)["phase"]=="review":break
    v=call(clients["buyer"],"/integration/attempts/"+rid,{"action":decision});assert attempt(v,rid)["phase"] in ("cancelled","rejected");assert len(v["competitive"]["agreements"])==1
rid=start({**requirements,"quantity":1,"targetPrice":400,"maximumPrice":500})
for _ in range(12):
    v=call(clients["buyer"],"/integration/attempts/"+rid,{"action":"advance"})
    if attempt(v,rid)["phase"]=="review":break
assert not any(s["status"]=="agreed" for s in attempt(v,rid)["sellers"])
call(clients["buyer"],"/integration/attempts/"+rid,{"action":"approve","sellerId":str(ids["product1"])},status=400)
call(clients["buyer"],"/auth/logout",{});call(clients["buyer"],"/integration/workspace",status=401)
async def verify_db():
    async with SessionLocal() as db:
        assert await db.scalar(select(func.count(Deal.id)))==1
        product=await db.get(Product,int(chosen["id"]));assert product.stock_quantity==([25,18,12][int(chosen["id"])-1]-10)
    await engine.dispose()
asyncio.run(verify_db());print(json.dumps({"result":"PASS","http_assertions":checks,"scenarios":["successful","failed","buyer rejection","cancellation"],"security":["unauthenticated access denied","forged identity denied","role access denied","private price isolation","cross-seller isolation","approval idempotency"],"persistence":"agreement survives workspace reload; stock deducted once","database":"disposable staging only"}))
