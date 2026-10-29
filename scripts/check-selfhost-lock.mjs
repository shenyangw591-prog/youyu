import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const staging=path.join(root,'outputs/youyu-server');
const cli=process.env.npm_execpath||process.argv[2];
if(!cli||!existsSync(cli))throw Error('Pass npm-cli.js as the first argument, or run with npm run selfhost:check-lock');
const cache=path.resolve(root,'../.tmp/youyu-npm-cache');
const version=spawnSync(process.execPath,[cli,'--version'],{encoding:'utf8',windowsHide:true});
if(version.status!==0)throw Error('Cannot read npm version');
const checks=[];
for(const check of [{name:'host',args:[]},{name:'linux-x64-glibc',args:['--os=linux','--cpu=x64','--libc=glibc']}]){
 const result=spawnSync(process.execPath,[cli,'ci','--dry-run','--ignore-scripts','--no-audit','--no-fund','--cache',cache,'--fetch-retries=1','--fetch-timeout=30000','--json',...check.args],{cwd:staging,encoding:'utf8',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0){console.error(result.stderr||result.stdout);process.exit(result.status||1);}
 checks.push({platform:check.name,ciDryRun:true});console.log('PASS npm ci lock check: '+check.name);
}
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const report={npm:version.stdout.trim(),node:process.versions.node,packageSha256:sha(path.join(staging,'package.json')),lockSha256:sha(path.join(staging,'package-lock.json')),checks,actualCleanInstallPerformed:false};
writeFileSync(path.join(root,'outputs/selfhost-lock-verification.json'),JSON.stringify(report,null,2)+'\n');
