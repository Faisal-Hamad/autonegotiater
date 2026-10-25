"""Publish model/storage matching; no migrations, seeding or production record updates."""
from pathlib import Path
import hashlib,json,subprocess,time,ssl,socket,http.client,os,sys
CONF=Path('/var/www/autonegotiater/infra/nginx/default.conf');EXPECTED='be0b2f703702c47734edb708dec7f5d3ecbb3947a3bdcdfb67016ee506699aef'
BACKUP=Path('/home/deploy/backups/autoneg-model-matching-20261025-r1')
API='autoneg-backend-web-r5';WEB='autoneg-frontend-web-r7'
API_IMAGE='c4d05f08274bfe6dbdc9b9310abfe38d572794e2d7adae4d5b017c860c7548cc'
WEB_IMAGE='064ea24d544bda94cca9d67b815e9a228d697d23691f55db2f88d7226d26db99'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True)
 if p.returncode:raise RuntimeError('Command failed; configuration output withheld')
 return p.stdout.strip()
def write(data):
 with CONF.open('r+b') as f:f.write(data);f.truncate();f.flush();os.fsync(f.fileno())
def request(path):
 ctx=ssl.create_default_context(cafile='/home/deploy/certs/origin.pem');ctx.verify_flags|=getattr(ssl,'VERIFY_X509_PARTIAL_CHAIN',0x80000)
 assert ctx.check_hostname and ctx.verify_mode==ssl.CERT_REQUIRED
 c=http.client.HTTPSConnection('autonegotiater.com',context=ctx,timeout=10)
 c._create_connection=lambda address,timeout=None,source_address=None:socket.create_connection(('127.0.0.1',443),timeout=timeout,source_address=source_address)
 try:
  c.request('GET',path,headers={'Host':'autonegotiater.com','Cache-Control':'no-cache'});r=c.getresponse();return r.status,json.loads(r.read())
 finally:c.close()
def health(name,web=False):
 code="fetch('http://127.0.0.1:3000/health/frontend').then(r=>r.json()).then(x=>console.log(JSON.stringify(x)))" if web else "import json,urllib.request;print(json.dumps(json.load(urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=5))))"
 for _ in range(20):
  try:
   h=json.loads(run(['podman','exec',name,'node' if web else 'python','-e' if web else '-c',code]));assert (h.get('mock') is False and h.get('mode')=='production') if web else h.get('db')=='ok';return
  except Exception:time.sleep(1)
 raise RuntimeError('New container not ready; routing unchanged')
def main():
 assert hashlib.sha256(CONF.read_bytes()).hexdigest()==EXPECTED,'Production routing changed; review required'
 for name,image in [('autoneg-backend-web-r4','427805495121453c4a65f8754c81b5d8f6121c2715433e38fed04e9c83bccb29'),('autoneg-frontend-web-r6','14671f4845076aec304d7b9452ec1c3214141486cad40b3dd6c63646935335f2')]:
  c=json.loads(run(['podman','inspect',name]))[0];assert c['Image']==image and c['State']['Running'],'Previous release changed'
 for image in [API_IMAGE,WEB_IMAGE]:assert run(['podman','image','inspect',image,'--format','{{.Id}}'])==image
 for name in [API,WEB]:assert subprocess.run(['podman','container','exists',name]).returncode==1,'Release name already exists; review required'
 assert not BACKUP.exists();BACKUP.mkdir(parents=True);BACKUP.chmod(0o700)
 original=CONF.read_bytes();p=BACKUP/'nginx-before-model-matching.conf';p.write_bytes(original);p.chmod(0o600);assert hashlib.sha256(p.read_bytes()).hexdigest()==EXPECTED
 print('PASS: previous release and private configuration backup verified.')
 run(['podman','run','-d','--name',API,'--restart=always','--network','autonegotiater_default','--memory=512m','--env-file','/var/www/autonegotiater/.env','-e','AUTH_COOKIE_SECURE=true','-e','AUTH_ALLOWED_ORIGINS=https://autonegotiater.com,https://www.autonegotiater.com',API_IMAGE]);health(API)
 run(['podman','run','-d','--name',WEB,'--restart=always','--network','autonegotiater_default','--memory=768m',WEB_IMAGE]);health(WEB,True)
 assert original.count(b'http://autoneg-backend-web-r4:8000/')==1 and original.count(b'http://autoneg-frontend-web-r6:3000')==1
 updated=original.replace(b'http://autoneg-backend-web-r4:8000/',b'http://autoneg-backend-web-r5:8000/').replace(b'http://autoneg-frontend-web-r6:3000',b'http://autoneg-frontend-web-r7:3000')
 try:
  assert hashlib.sha256(CONF.read_bytes()).hexdigest()==EXPECTED
  write(updated);run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload']);time.sleep(2)
  code,h=request('/health/frontend');assert code==200 and h['mock'] is False
  code,h=request('/api/health');assert code==200 and h['db']=='ok'
  for path in ['/api/auth/me','/api/integration/workspace','/api/workspace/bootstrap?viewer_id=1']:assert request(path)[0]==401,'Private route accessible anonymously'
  code,items=request('/api/integration/catalog');assert code==200
  selected=next(x for x in items if x['product']['id']==1);same=[x for x in items if x['listing']['matchKey']==selected['listing']['matchKey']]
  assert {1,92,93}.issubset({x['product']['id'] for x in same}),'Expected model listings missing'
  assert all(not {'minimumPrice','maximumDiscount','declaredMinimumPrice'}.intersection(x['listing']) for x in items),'Private limits exposed'
 except Exception:
  write(original);run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload']);print('ROLLED BACK to the previous authenticated release. No database changes.');raise
 result={'status':'DEPLOYED','frontend':WEB,'frontend_image':WEB_IMAGE,'backend':API,'backend_image':API_IMAGE,'nginx_sha256':hashlib.sha256(CONF.read_bytes()).hexdigest(),'matching_listings':[{'id':x['product']['id'],'seller':x['listing']['name'],'product':x['product']['name'],'delivery':x['listing']['deliveryDays']} for x in same],'database_migrations':False,'production_fixtures':False}
 p=BACKUP/'release-manifest.json';p.write_text(json.dumps(result,indent=2));p.chmod(0o600);print(json.dumps(result))
if __name__=='__main__':
 try:main()
 except Exception as e:print('STOP:',type(e).__name__,str(e));sys.exit(1)