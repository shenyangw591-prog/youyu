import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {existsSync} from 'node:fs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!existsSync(path.join(root,'node_modules','vinext'))){
  console.error('运行文件尚未安装，请先在 Codex 中完成项目安装。');
  process.exit(1);
}
const url='http://127.0.0.1:5173/';
console.log('正在启动有余，请稍候…');
const server=spawn(process.execPath,['scripts/run-framework.mjs','dev','--port','5173'],{cwd:root,stdio:'inherit'});
let finished=false;
server.on('exit',code=>{if(!finished){finished=true;process.exitCode=code||1}});
for(let attempt=0;attempt<60&&!finished;attempt++){
  try{
    const response=await fetch(url);
    const html=await response.text();
    if(response.ok&&html.includes('有余')){
      console.log('浏览器已打开。关闭此窗口即可结束本地预览。');
      spawn('cmd.exe',['/c','start','',url],{cwd:root,detached:true,stdio:'ignore'}).unref();
      break;
    }
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
}
if(!finished){
  process.on('SIGINT',()=>server.kill('SIGINT'));
  process.on('SIGTERM',()=>server.kill('SIGTERM'));
}
