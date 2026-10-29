from pathlib import Path
import hashlib,json,zipfile
project=Path(__file__).resolve().parents[1]
source=project/'outputs'/'youyu-server'
output=project.parent/'服务器部署'/'youyu-server-1.0.0.zip'
report=json.loads((project/'outputs'/'selfhost-lock-verification.json').read_text(encoding='utf-8'))
sha=lambda content:hashlib.sha256(content).hexdigest()
assert sha((source/'package.json').read_bytes())==report['packageSha256'],'Run the npm lock check after changing package.json'
assert sha((source/'package-lock.json').read_bytes())==report['lockSha256'],'Run the npm lock check after changing the lock'
assert any(c['platform']=='linux-x64-glibc' and c['ciDryRun'] for c in report['checks']),'Linux dependency preflight is required'
excluded={'.next','node_modules','data','.git','.qa-data'}
files=[p for p in source.rglob('*') if p.is_file() and not any(part in excluded or part.startswith('.qa') for part in p.relative_to(source).parts)]
for p in files:
    name=p.relative_to(source).as_posix()
    assert not any(s in name.lower() for s in ['release-credentials','.keystore','.p12','.sqlite','.env.local']),name
output.parent.mkdir(parents=True,exist_ok=True)
staging=output.with_suffix('.zip.tmp')
with zipfile.ZipFile(staging,'w',zipfile.ZIP_DEFLATED,compresslevel=6,strict_timestamps=False) as archive:
    for p in sorted(files): archive.write(p,p.relative_to(source).as_posix())
with zipfile.ZipFile(staging) as archive:
    assert archive.testzip() is None
    names=set(archive.namelist())
    for required in ['package.json','package-lock.json','.env.production','runtime/store.mjs','app/api/auth/route.ts','app/api/ledger/route.ts','ubuntu/install.sh','ubuntu/nginx.conf','ubuntu/youyu.service','public/downloads/youyu-1.0.0.apk']: assert required in names,required
    assert sha(archive.read('package-lock.json'))==report['lockSha256']
    info=json.loads(archive.read('public/downloads/release.json'))
    assert sha(archive.read('public/downloads/'+info['filename']))==info['sha256']
    assert json.loads(archive.read('package.json'))['dependencies']==json.loads(archive.read('package-lock.json'))['packages']['']['dependencies']
staging.replace(output)
checksum=sha(output.read_bytes())
output.with_suffix('.SHA256.txt').write_text(checksum+'  '+output.name+'\n',encoding='utf-8')
print(json.dumps({'archive':str(output),'bytes':output.stat().st_size,'files':len(files),'sha256':checksum,'npmLockPreflight':report['checks'],'privateSigningAndDatabaseFilesExcluded':True,'apkSha256Verified':True},ensure_ascii=False,indent=2))
