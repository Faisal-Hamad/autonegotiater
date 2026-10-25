"""Create a local allowlisted source archive, never transfer it or run deployment commands."""
from pathlib import Path
import hashlib,json,re,zipfile
frontend=Path(__file__).resolve().parents[1]
assert frontend.name=='frontend' and frontend.parent.name=='autonegotiater-multi-seller-demo'
files={}
for folder in ['app','components','lib','public']:
 for f in (frontend/folder).rglob('*'):
  if not f.is_file():continue
  assert not f.is_symlink()
  assert f.name=='.gitkeep' or f.suffix.lower() in {'.ts','.tsx','.css','.svg','.png','.jpg','.jpeg','.webp','.ico','.gif','.avif','.woff','.woff2'},'Unexpected source asset type'
  files[f.relative_to(frontend).as_posix()]=f.read_bytes()
for name in ['package.json','package-lock.json','next.config.ts','tsconfig.json','next-env.d.ts','postcss.config.mjs']:
 files[name]=(frontend/name).read_bytes()
files['Containerfile']=(frontend/'release/Containerfile').read_bytes()
ignore='.env\n.env.*\n**/.env*\nnode_modules\n.next*\ntests\nverification\n.npm-cache\nrelease\n.git\n'
files['.containerignore']=ignore.encode()
files['.dockerignore']=ignore.encode()
for name,data in files.items():
 assert not any(part.startswith('.env') for part in Path(name).parts)
 if name.endswith(('.ts','.tsx','.json','.mjs')):
  text=data.decode('utf-8-sig')
  for pattern in [r'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----',r'AKIA[A-Z0-9]{16}',r'ghp_[A-Za-z0-9]{30,}']:
   assert not re.search(pattern,text),'Sensitive-looking content: package refused (values redacted)'
manifest={name:hashlib.sha256(data).hexdigest() for name,data in sorted(files.items())}
files['SOURCE_MANIFEST.json']=json.dumps({'purpose':'isolated frontend staging, not a production release','mock':False,'productionImageParity':'NOT_VERIFIED','files':manifest},indent=2).encode()
out=frontend/'release/artifacts';out.mkdir(exist_ok=True)
archive=out/'autonegotiater-frontend-staging-20261019.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name,data in sorted(files.items()):
  info=zipfile.ZipInfo(name,date_time=(2026,10,19,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
 for name,h in manifest.items():assert hashlib.sha256(z.read(name)).hexdigest()==h
 assert not any(name.startswith(('tests/','backend/','infra/')) or '.env' in name for name in z.namelist())
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_suffix('.zip.sha256')).write_text(checksum+'  '+archive.name+'\n',encoding='ascii')
print(json.dumps({'archive':str(archive),'sha256':checksum,'sourceFiles':len(manifest),'credentialsOrEnvFilesIncluded':False,'networkOrDeployExecuted':False}))
