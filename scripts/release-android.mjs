import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
for(const args of [['scripts/mobile-assets.mjs'],['node_modules/vite/bin/vite.js','build','--config','mobile/vite.config.ts'],['scripts/build-android-release.mjs']]) {
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
