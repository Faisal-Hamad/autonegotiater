"""Synthetic fixtures only. Refuses production. Tests cross-catalog model matching and actual agreed variant."""
import asyncio,json,urllib.request,urllib.error,http.cookiejar,secrets
from decimal import Decimal
from sqlalchemy import select,func
from app.db import SessionLocal,engine
from app.models import User,Product,SellerRule
from app.security import hash_password
from app.config import settings
assert 'autoneg_integration_stage' in settings.database_url and 'stage-db' in settings.database_url,'Refusing production'
BASE='http://127.0.0.1:8000';password=secrets.token_urlsafe(20);ids={};checks=0
names=['iPhone 15 Pro 256GB - Natural Titanium','iPhone 15 Pro 256GB - Blue Titanium','iPhone 15 Pro 256GB - Black Titanium','iPhone 15 Pro Max 256GB - Natural Titanium','iPhone 15 Pro 128GB - Natural Titanium','Case for iPhone 15 Pro 256GB']
async def seed():
 async with SessionLocal() as db:
  assert not await db.scalar(select(func.count(User.id))),'Fixture database must be empty'
  for name,role in [('buyer','buyer'),('seller1','seller'),('seller2','seller'),('seller3','seller')]:
   u=User(first_name='STAGING',last_name=name,email=name+'@model-test.invalid',password_hash=hash_password(password),role=role,is_active=True);db.add(u);await db.flush();ids[name]=u.id
  for n,name in enumerate(names,1):
   p=Product(seller_id=ids['seller'+str(min(n,3))],name=name,category='Electronics',description=['Natural color; 95% battery; retail box.','Blue color; 89% battery; two cases.','Black color; 92% battery; handset only.'][min(n,3)-1],base_price=Decimal(3900-100*n),min_acceptable_price=Decimal(2600),stock_quantity=6);db.add(p);await db.flush();ids['p'+str(n)]=p.id;db.add(SellerRule(seller_id=p.seller_id,product_id=p.id,min_price=p.min_acceptable_price,max_discount=Decimal(40),max_rounds=6,auto_accept_threshold=p.base_price))
  await db.commit()
 await engine.dispose()
asyncio.run(seed())
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(c,path,body=None,status=200):
 global checks
 req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers={'Origin':'http://127.0.0.1:33327','Content-Type':'application/json'})
 try:
  r=c.open(req,timeout=20);code=r.status;data=json.load(r)
 except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
 assert code==status,(path,code,data);checks+=1;return data
anon=client();clients={}
for name in ['buyer','seller1','seller2','seller3']:
 clients[name]=client();call(clients[name],'/auth/login',{'email':name+'@model-test.invalid','password':password})
public=call(anon,'/integration/catalog');rows=[x for x in public if x['product']['id'] in [ids['p1'],ids['p2'],ids['p3']]]
assert len({x['listing']['catalogId'] for x in rows})==3,'Existing listing identities must remain distinct'
assert len({x['listing']['matchKey'] for x in rows})==1
assert all(x['listing']['matchKey']!=rows[0]['listing']['matchKey'] for x in public if x['product']['id'] in [ids['p4'],ids['p5'],ids['p6']])
r={'quantity':1,'targetPrice':3000,'maximumPrice':4000,'deliveryDays':7,'maxRounds':6}
call(clients['buyer'],'/integration/attempts',{'productId':ids['p1'],'requirements':r,'matchingPolicy':'model-storage-v1'},400)
for n in (1,2,3):
 call(clients['seller'+str(n)],'/integration/listings',{'catalogProductId':ids['p'+str(n)],'productId':ids['p'+str(n)],'listing':{'startingPrice':3900-100*n,'minimumPrice':2600,'declaredMinimumPrice':2600,'maximumDiscount':40,'stock':6,'deliveryDays':5 if n<3 else 9,'concession':150,'maxRounds':6,'enabled':True,'strategy':'competitive'}})
# Older clients retain exact-catalog semantics, despite the new public model grouping.
v=call(clients['buyer'],'/integration/attempts',{'productId':ids['p1'],'requirements':r});old=v['competitive']['attempts'][-1];assert len(old['sellers'])==1
call(clients['buyer'],'/integration/attempts/'+old['attemptId'],{'action':'cancel'})
v=call(clients['buyer'],'/integration/attempts',{'productId':ids['p1'],'requirements':r,'matchingPolicy':'model-storage-v1'});a=v['competitive']['attempts'][-1];rid=a['attemptId'];assert len(a['sellers'])==3
assert {s['productName'] for s in a['sellers']}==set(names[:3]);assert not a['sellers'][1]['exactProduct'];assert a['sellers'][2]['status']=='excluded'
assert 'minimumPrice' not in json.dumps(a)
for _ in range(12):
 v=call(clients['buyer'],'/integration/attempts/'+rid,{'action':'advance'});a=next(x for x in v['competitive']['attempts'] if x['attemptId']==rid)
 if a['phase']=='review':break
chosen=next(s for s in a['sellers'] if s['productId']==ids['p2']);assert chosen['status']=='agreed'
sv=call(clients['seller2'],'/integration/workspace');assert 'maximumPrice' not in json.dumps(sv);assert all(s['productId']==ids['p2'] and s['productName']==names[1] for s in sv['competitive']['sellerSessions'])
# Change public terms through the owning Seller API; stale agreements must fail closed.
product=next(p for p in sv['state']['products'] if p['id']==ids['p2']);original_description=product['description']
call(clients['seller2'],'/integration/changes',{'kind':'product','reference':ids['p2'],'data':{**product,'description':'Changed condition after negotiation'}})
call(clients['buyer'],'/integration/attempts/'+rid,{'action':'approve','sellerId':chosen['id']},409)
call(clients['seller2'],'/integration/changes',{'kind':'product','reference':ids['p2'],'data':{**product,'description':original_description}})
v=call(clients['buyer'],'/integration/attempts/'+rid,{'action':'approve','sellerId':chosen['id']});g=v['competitive']['agreements'][-1]
assert g['productId']==ids['p2'] and g['productName']==names[1] and g['productDescription']==original_description
assert g['requestedProductId']==ids['p1'] and g['catalogProductId']==str(ids['p2'])
v=call(clients['buyer'],'/integration/attempts/'+rid,{'action':'approve','sellerId':chosen['id']});assert len(v['competitive']['agreements'])==1
async def verify():
 async with SessionLocal() as db:
  assert (await db.get(Product,ids['p1'])).stock_quantity==6
  assert (await db.get(Product,ids['p2'])).stock_quantity==5
 await engine.dispose()
asyncio.run(verify())
print(json.dumps({'result':'PASS','http_assertions':checks,'matching':'three colors grouped; Pro Max, 128GB and accessories excluded','legacy':'old clients retain exact matching','approval':'actual Blue product recorded; changed terms rejected; stock deducted once','privacy':'private limits and other Seller messages remain isolated','database':'synthetic isolated staging only'}))