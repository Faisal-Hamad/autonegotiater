"""Read-only loopback smoke checks for the isolated Demo and standard production artifact."""
from urllib.request import urlopen
import json,re
base='http://127.0.0.1:3117'
with urlopen(base+'/api/health',timeout=5) as r:
 health=json.load(r);assert health['mode']=='demo' and health['mock'] is True and health['backendConnected'] is False and health['storage']=='browser-local'
paths=['/','/products','/products/1','/products/7','/products/7/negotiate','/products/7/competitive','/dashboard/buyer','/dashboard/buyer/negotiations','/dashboard/buyer/deals','/dashboard/seller','/dashboard/seller/products','/dashboard/seller/negotiations','/dashboard/seller/deals','/dashboard/admin','/dashboard/admin/users','/dashboard/admin/products','/dashboard/admin/negotiations','/dashboard/admin/reports','/dashboard/admin/system','/dashboard/admin/permissions','/login','/register','/profile','/notifications']
for path in paths:
 with urlopen(base+path,timeout=15) as r:
  text=r.read().decode('utf-8');assert r.status==200,(path,r.status)
  assert "connect-src 'self'" in r.headers.get('Content-Security-Policy',''),path
  assert 'Account features are unavailable until secure sign-in' not in text,path
  if path=='/products':
   assert 'Dell XPS 15' in text
   css=re.search(r'href="([^\"]+\.css[^\"]*)"',text).group(1);assert css.startswith('/_next/static/')
   with urlopen(base+css,timeout=5) as style:assert style.status==200
with urlopen('http://127.0.0.1:3118/api/health',timeout=5) as r:
 standard=json.load(r);assert standard['mode']=='standard' and standard['mock'] is False
print(json.dumps({'demo_production_routes':len(paths),'status':'PASS','demo':health,'standard_build_cannot_be_enabled_by_runtime_flags':'PASS','CSP_and_CSS':'PASS','network_targets':'loopback only; no backend/DB'}))
