"""Resume routing after successful migration/container start; never rerun migrations."""
import hashlib,json,os,subprocess,sys,time,ssl,socket,http.client
from pathlib import Path
CONF=Path('/var/www/autonegotiater/infra/nginx/default.conf')
BACKUP=Path('/home/deploy/backups/autoneg-pre-integration-20261025-r1')
BASELINE='d04b1851275e0b98dd7a0f58ebb842a8fe00fe3df8850724a675c809fe200544'
API='autoneg-backend-web-r4';WEB='autoneg-frontend-web-r5'
IMAGES={API:'427805495121453c4a65f8754c81b5d8f6121c2715433e38fed04e9c83bccb29',WEB:'97b528df6cbf711d400e581f5f91188b14b73d017cb910888c832c4adedbc6b4'}
def run(args):
 p=subprocess.run(args,capture_output=True,text=True)
 if p.returncode:raise RuntimeError('Command failed; configuration output withheld')
 return p.stdout.strip()
def write(data):
 with CONF.open('r+b') as f:f.write(data);f.truncate();f.flush();os.fsync(f.fileno())
def request(path):
 ctx=ssl.create_default_context(cafile='/home/deploy/certs/origin.pem')
 ctx.verify_flags|=getattr(ssl,'VERIFY_X509_PARTIAL_CHAIN',0x80000)
 assert ctx.check_hostname and ctx.verify_mode==ssl.CERT_REQUIRED
 c=http.client.HTTPSConnection('autonegotiater.com',context=ctx,timeout=10)
 c._create_connection=lambda address,timeout=None,source_address=None:socket.create_connection(('127.0.0.1',443),timeout=timeout,source_address=source_address)
 try:
  c.request('GET',path,headers={'Host':'autonegotiater.com','Cache-Control':'no-cache'})
  response=c.getresponse();data=json.loads(response.read());return response.status,data
 finally:c.close()
def preflight():
 assert hashlib.sha256(CONF.read_bytes()).hexdigest()==BASELINE,'Nginx changed; review required'
 for name,entry in json.loads((BACKUP/'backup-manifest.json').read_text())['files'].items():
  p=BACKUP/name;assert p.stat().st_size==entry['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256'],'Backup mismatch'
 for name,image in IMAGES.items():
  m=json.loads(run(['podman','inspect',name]))[0];assert m['Image']==image and m['State']['Running'],'Unexpected release container'
 # Check new app health without changing routing.
 api_code="import json,urllib.request; print(json.dumps(json.load(urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=5))))"
 assert json.loads(run(['podman','exec',API,'python','-c',api_code]))['db']=='ok'
 web_code="fetch('http://127.0.0.1:3000/health/frontend').then(r=>r.json()).then(x=>console.log(JSON.stringify(x)))"
 h=json.loads(run(['podman','exec',WEB,'node','-e',web_code]));assert h['mode']=='production' and h['mock'] is False
 assert request('/api/health')[1]['db']=='ok'
 print('PASS: backup hashes, unchanged original routing, tested images, app health, verified TLS origin.')
def cutover():
 preflight();original=CONF.read_bytes()
 assert original.count(b'proxy_pass http://fastapi:8000/;')==1 and original.count(b'proxy_pass http://nextjs:3000;')==1
 updated=original.replace(b'proxy_pass http://fastapi:8000/;',b'proxy_pass http://autoneg-backend-web-r4:8000/;').replace(b'proxy_pass http://nextjs:3000;',b'proxy_pass http://autoneg-frontend-web-r5:3000;')
 try:
  assert hashlib.sha256(CONF.read_bytes()).hexdigest()==BASELINE
  write(updated);run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload']);time.sleep(2)
  status,h=request('/health/frontend');assert status==200 and h['mode']=='production' and h['mock'] is False,'Production frontend health failed'
  print('PASS: production frontend, mock disabled.')
  status,h=request('/api/health');assert status==200 and h['db']=='ok','API health failed'
  for path in ['/api/auth/me','/api/integration/workspace','/api/workspace/bootstrap?viewer_id=1']:
   status,_=request(path);assert status==401,'Unauthenticated isolation failed: '+path;print('PASS: anonymous request denied:',path)
 except Exception:
  write(original);run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload'])
  print('ROLLED BACK: original routing restored; no database downgrade or record deletion.');raise
 print('CUTOVER SUCCESS. Public browser verification still required.')
 print('Nginx release SHA256:',hashlib.sha256(CONF.read_bytes()).hexdigest())
if __name__=='__main__':
 try:
  if sys.argv[1:]==['--preflight']:preflight()
  elif sys.argv[1:]==['--apply']:cutover()
  else:raise RuntimeError('Use --preflight or --apply')
 except Exception as e:print('STOP:',type(e).__name__,str(e));sys.exit(1)