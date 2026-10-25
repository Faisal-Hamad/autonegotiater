"""Local standalone smoke test only; fixed loopback URLs, no production access."""
from urllib.request import urlopen
from urllib.error import HTTPError
import json,re
base='http://127.0.0.1:3107'
def read(path):
 try:
  with urlopen(base+path,timeout=15) as r:return r.status,r.read().decode('utf-8')
 except HTTPError as e:return e.code,e.read().decode('utf-8')
health=json.loads(read('/api/health')[1]);assert health['mock'] is False and health['releaseReady'] is False and health['privateFeatures']=='blocked'
paths=['/dashboard/buyer','/dashboard/buyer/negotiations','/dashboard/buyer/deals','/dashboard/seller','/dashboard/seller/products','/dashboard/admin','/dashboard/admin/reports','/login','/register','/profile','/notifications','/products/901/negotiate','/products/901/competitive']
for path in paths:
 status,html=read(path);assert status==200,(path,status)
 assert 'secure sign-in' in html,(path,'missing private boundary')
 assert 'LOCAL DEMO' not in html and 'Restoring local demo' not in html,(path,'production Mock leakage')
status,html=read('/products');assert status==200 and 'Contract test laptop' in html and 'LOCAL DEMO' not in html
css=re.search(r'href="([^\"]+\.css[^\"]*)"',html).group(1);assert css.startswith('/_next/static/') and read(css)[0]==200
status,detail=read('/products/901');assert status==200 and 'SAR' in detail and 'secure buyer authentication' in detail
for path in ['/products/99999','/products/not-an-id']:
 status,html=read(path);assert status in (200,404) and 'Page or product not found' in html and 'noindex' in html
# Next.js streamed notFound responses may have HTTP 200 after headers are sent.
print(json.dumps({'standalone_local_smoke':'PASS','private_routes':len(paths),'health':health,'public_catalog':'local HTTP contract test double only','product_not_found':'PASS (streamed HTTP 200 with noindex)','css':'PASS','production_database':'NOT_ACCESSED'}))
