"""Rollback model matching to previous authenticated release; retain all records and tables."""
import hashlib,json,subprocess,os,sys
from pathlib import Path
conf=Path('/var/www/autonegotiater/infra/nginx/default.conf')
backup=Path('/home/deploy/backups/autoneg-model-matching-20261025-r1/nginx-before-model-matching.conf')
assert hashlib.sha256(conf.read_bytes()).hexdigest()=='79f6c1e809b9cc5befaa78be36aa7c9b5b82afa6ab8ecf255ae68e982450bd37','Configuration changed; review required'
assert hashlib.sha256(backup.read_bytes()).hexdigest()=='be0b2f703702c47734edb708dec7f5d3ecbb3947a3bdcdfb67016ee506699aef','Backup mismatch'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True)
 if p.returncode:raise RuntimeError('Command failed; output withheld')
 return p.stdout
def write(data):
 with conf.open('r+b') as f:f.write(data);f.truncate();f.flush();os.fsync(f.fileno())
for name,image in [('autoneg-backend-web-r4','427805495121453c4a65f8754c81b5d8f6121c2715433e38fed04e9c83bccb29'),('autoneg-frontend-web-r6','14671f4845076aec304d7b9452ec1c3214141486cad40b3dd6c63646935335f2')]:
 c=json.loads(run(['podman','inspect',name]))[0];assert c['Image']==image and c['State']['Running'],'Previous authenticated container unavailable'
if sys.argv[1:]==['--check']:
 print('PASS: model matching rollback prerequisites. No changes made.');sys.exit(0)
if sys.argv[1:]!=['--apply']:raise RuntimeError('Use --check or --apply')
current=conf.read_bytes()
try:
 write(backup.read_bytes());run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload'])
except Exception:
 write(current);run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload']);raise
print('Previous authenticated release routing restored; no records deleted, migrations reversed or containers stopped.')