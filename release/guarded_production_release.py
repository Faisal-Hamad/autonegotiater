"""Guarded production integration release. No Git, seeding, fixtures, record deletion or DB downgrade."""
import hashlib,json,os,subprocess,sys,time,urllib.request,urllib.error
from pathlib import Path
BACKUP=Path('/home/deploy/backups/autoneg-pre-integration-20261025-r1')
CONF=Path('/var/www/autonegotiater/infra/nginx/default.conf')
ENV='/var/www/autonegotiater/.env'
NETWORK='autonegotiater_default'
API='autoneg-backend-web-r4'
WEB='autoneg-frontend-web-r5'
API_IMAGE='427805495121453c4a65f8754c81b5d8f6121c2715433e38fed04e9c83bccb29'
WEB_IMAGE='97b528df6cbf711d400e581f5f91188b14b73d017cb910888c832c4adedbc6b4'
BASELINE='d04b1851275e0b98dd7a0f58ebb842a8fe00fe3df8850724a675c809fe200544'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True)
 if p.returncode:raise RuntimeError('Command failed: '+args[0]+' '+args[1]+'; output withheld to protect configuration values')
 return p.stdout.strip()
def metadata(name):return json.loads(run(['podman','inspect',name]))[0]
def write_conf(data):
 with CONF.open('r+b') as f:f.write(data);f.truncate();f.flush();os.fsync(f.fileno())
def preflight():
 m=json.loads((BACKUP/'backup-manifest.json').read_text())
 for name,entry in m['files'].items():
  p=BACKUP/name
  assert p.stat().st_size==entry['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256'],'Backup verification failed'
 assert hashlib.sha256(CONF.read_bytes()).hexdigest()==BASELINE,'Nginx changed; stop for review'
 assert metadata('autoneg-fastapi')['Image']=='5e55b42cfadb2a7724d7ff88899c4dbe3db54feabac8f7ecf616dda42bf7e443'
 assert metadata('autoneg-nextjs')['Image']=='5c8666806184c7d77e5d482f6864a7d2fc2356ccbde2528f24a912dbf21886a4'
 assert run(['podman','image','inspect',API_IMAGE,'--format','{{.Id}}'])==API_IMAGE
 assert run(['podman','image','inspect',WEB_IMAGE,'--format','{{.Id}}'])==WEB_IMAGE
 assert Path(ENV).is_file()
 for name in [API,WEB]:
  p=subprocess.run(['podman','container','exists',name])
  assert p.returncode==1,'Release container already exists; stop for review'
 print('PASS: backups, immutable images, original containers and unchanged Nginx baseline.')
def inside_health(container,url):
 if container==WEB:
  code="fetch("+json.dumps(url)+").then(async r=>{if(!r.ok)process.exit(1);console.log(JSON.stringify(await r.json()))}).catch(()=>process.exit(1))"
  return json.loads(run(['podman','exec',container,'node','-e',code]))
 code='import json,urllib.request; print(json.dumps(json.load(urllib.request.urlopen('+repr(url)+',timeout=5))))'
 return json.loads(run(['podman','exec',container,'python','-c',code]))
def wait_ready(name,url):
 for _ in range(20):
  try:return inside_health(name,url)
  except Exception:time.sleep(1)
 raise RuntimeError('New release health check failed')
def request(path):
 try:
  with urllib.request.urlopen('https://autonegotiater.com'+path,timeout=12) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,None

def apply():
 preflight()
 original=CONF.read_bytes()
 revision_code='import asyncio; from sqlalchemy import text; from app.db import engine; exec("async def main():\\n async with engine.connect() as c:\\n  print(await c.scalar(text(\\\"SELECT version_num FROM alembic_version\\\")))\\n await engine.dispose()\\nasyncio.run(main())".replace("\\\\n","\\n"))'
 # Read schema metadata only, not business records. The migration must start at 0002.
 revision_source="import asyncio\nfrom sqlalchemy import text\nfrom app.db import engine\nasync def main():\n async with engine.connect() as c:\n  print(await c.scalar(text('SELECT version_num FROM alembic_version')))\n await engine.dispose()\nasyncio.run(main())\n"
 assert run(['podman','exec','autoneg-fastapi','python','-c',revision_source])=='0002','Unexpected DB schema; stop for review'
 print('Applying additive migration 0003: web_auth_sessions and web_integration_records only.')
 run(['podman','run','--rm','--network',NETWORK,'--env-file',ENV,API_IMAGE,'alembic','upgrade','0003'])
 run(['podman','run','-d','--name',API,'--restart=always','--network',NETWORK,'--network-alias','autoneg-backend-web-r1','--memory=512m','--env-file',ENV,'-e','AUTH_COOKIE_SECURE=true','-e','AUTH_ALLOWED_ORIGINS=https://autonegotiater.com,https://www.autonegotiater.com',API_IMAGE])
 assert wait_ready(API,'http://127.0.0.1:8000/health').get('db')=='ok'
 run(['podman','run','-d','--name',WEB,'--restart=always','--network',NETWORK,'--memory=768m',WEB_IMAGE])
 h=wait_ready(WEB,'http://127.0.0.1:3000/health/frontend')
 assert h.get('mode')=='production' and h.get('mock') is False
 updated=original.replace(b'proxy_pass http://fastapi:8000/;',b'proxy_pass http://autoneg-backend-web-r4:8000/;').replace(b'proxy_pass http://nextjs:3000;',b'proxy_pass http://autoneg-frontend-web-r5:3000;')
 assert original.count(b'proxy_pass http://fastapi:8000/;')==1 and original.count(b'proxy_pass http://nextjs:3000;')==1
 try:
  assert hashlib.sha256(CONF.read_bytes()).hexdigest()==BASELINE
  write_conf(updated)
  run(['podman','exec','autoneg-nginx','nginx','-t'])
  run(['podman','exec','autoneg-nginx','nginx','-s','reload'])
  time.sleep(2)
  code,h=request('/health/frontend?release=20261025-r5');assert code==200 and h.get('mock') is False and h.get('mode')=='production'
  code,h=request('/api/health?release=20261025-r5');assert code==200 and h.get('db')=='ok'
  code,_=request('/api/auth/me');assert code==401
  code,_=request('/api/integration/workspace');assert code==401
  code,_=request('/api/workspace/bootstrap?viewer_id=1');assert code==401
 except Exception:
  write_conf(original)
  run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload'])
  print('ROLLED BACK: original proxy routing restored. Additive schema remains; no record restore or table deletion.')
  raise
 print('DEPLOYED: production frontend and authenticated API; mock disabled; anonymous private access denied. Original containers retained.')
 print('Nginx release SHA256:',hashlib.sha256(CONF.read_bytes()).hexdigest())
if __name__=='__main__':
 try:
  if sys.argv[1:]==['--apply']:apply()
  elif sys.argv[1:]==['--preflight']:preflight()
  else:raise RuntimeError('Use --preflight or --apply')
 except Exception as e:
  print('STOP:',str(e));sys.exit(1)