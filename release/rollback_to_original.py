"""Restore original routing only. Keep current database and all new records."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
conf=Path('/var/www/autonegotiater/infra/nginx/default.conf')
backup=Path('/home/deploy/backups/autoneg-pre-integration-20261025-r1/nginx-default.conf')
release_hash='be0b2f703702c47734edb708dec7f5d3ecbb3947a3bdcdfb67016ee506699aef'
original_hash='d04b1851275e0b98dd7a0f58ebb842a8fe00fe3df8850724a675c809fe200544'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True)
 if p.returncode:raise RuntimeError('Rollback command failed; output withheld')
 return p.stdout

def write(data):
 with conf.open('r+b') as f:f.write(data);f.truncate();f.flush();os.fsync(f.fileno())
assert hashlib.sha256(conf.read_bytes()).hexdigest()==release_hash,'Routing changed after this release. Review before rollback.'
assert hashlib.sha256(backup.read_bytes()).hexdigest()==original_hash,'Original configuration backup failed verification.'
for name,image in [('autoneg-nextjs','5c8666806184c7d77e5d482f6864a7d2fc2356ccbde2528f24a912dbf21886a4'),('autoneg-fastapi','5e55b42cfadb2a7724d7ff88899c4dbe3db54feabac8f7ecf616dda42bf7e443')]:
 c=json.loads(run(['podman','inspect',name]))[0];assert c['Image']==image and c['State']['Running'],'Original container unavailable; stop for review.'
if sys.argv[1:]==['--check']:
 print('PASS: rollback prerequisites. No changes made.');sys.exit(0)
if sys.argv[1:]!=['--apply']:
 print('Use --check or --apply. No changes made.');sys.exit(1)
current=conf.read_bytes()
try:
 write(backup.read_bytes());run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload'])
except Exception:
 write(current);run(['podman','exec','autoneg-nginx','nginx','-t']);run(['podman','exec','autoneg-nginx','nginx','-s','reload']);raise
print('Original frontend/API routing restored. No database restore, downgrade, deletion or container stop performed.')