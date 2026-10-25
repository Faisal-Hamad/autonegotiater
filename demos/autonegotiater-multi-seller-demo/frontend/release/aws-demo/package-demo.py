"""Build an allowlisted frontend-only Demo ZIP locally. No network/container/deployment actions."""
from pathlib import Path
import hashlib,json,re,zipfile
frontend=Path(__file__).resolve().parents[2]
assert frontend.name=='frontend' and frontend.parent.name=='autonegotiater-multi-seller-demo'
files={}
for folder in ['app','components','lib','public']:
 for f in (frontend/folder).rglob('*'):
  if not f.is_file():continue
  assert not f.is_symlink()
  assert f.name=='.gitkeep' or f.suffix.lower() in {'.ts','.tsx','.css','.svg','.png','.jpg','.jpeg','.webp','.ico','.gif','.avif','.woff','.woff2'}
  files[f.relative_to(frontend).as_posix()]=f.read_bytes()
for name in ['package.json','package-lock.json','next.config.ts','postcss.config.mjs']:
 files[name]=(frontend/name).read_bytes()
# Generated host build directories must not leak into the portable build context.
config=json.loads((frontend/'tsconfig.json').read_text(encoding='utf-8'))
config['include']=['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'];config['exclude']=['node_modules']
files['tsconfig.json']=(json.dumps(config,indent=2)+'\n').encode()
files['next-env.d.ts']=b'/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n'
for name in ['Containerfile','demo-network-guard.cjs']:
 files[name]=(frontend/'release/aws-demo'/name).read_bytes()
ignore='.env\n.env.*\n**/.env*\nnode_modules\n.next*\n.git\nbackend\ninfra\ntests\nverification\nrelease\n'
files['.containerignore']=ignore.encode();files['.dockerignore']=ignore.encode()
for name,data in files.items():
 assert not any(part.startswith('.env') for part in Path(name).parts)
 if name.endswith(('.ts','.tsx','.json','.mjs','.cjs')):
  for pattern in [r'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----',r'AKIA[A-Z0-9]{16}',r'ghp_[A-Za-z0-9]{30,}']:
   assert not re.search(pattern,data.decode('utf-8-sig')),'Sensitive-looking source: refused, values redacted'
manifest={name:hashlib.sha256(data).hexdigest() for name,data in sorted(files.items())}
files['DEMO_MANIFEST.json']=json.dumps({'purpose':'ISOLATED DEMO ONLY','buildFlag':'AUTONEG_ISOLATED_DEMO_BUILD=true','backend':'DISCONNECTED','storage':'browser-local synthetic data','productionReady':False,'portableConfig':True,'files':manifest},indent=2).encode()
out=frontend/'release/aws-demo/artifacts';out.mkdir(exist_ok=True)
archive=out/'autonegotiater-isolated-demo-r1.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name,data in sorted(files.items()):
  info=zipfile.ZipInfo(name,date_time=(2026,10,19,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
 for name,h in manifest.items():assert hashlib.sha256(z.read(name)).hexdigest()==h
 assert not any(name.startswith(('backend/','infra/','tests/')) or '.env' in name for name in z.namelist())
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(checksum+'  '+archive.name+'\n',encoding='ascii')
print(json.dumps({'archive':str(archive),'sha256':checksum,'files':len(files),'productionConnections':False,'deploymentExecuted':False}))
