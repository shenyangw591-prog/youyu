import { type Transaction, type BucketId, parseMoney } from './ledger';
export type ImportRow=Transaction & {selected:boolean;duplicate:boolean;note:string};
export function parseCSV(text:string):string[][]{const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell=''}else cell+=c}if(quoted)throw Error('CSV 引号不完整，请重新导出账单');if(cell||row.length){row.push(cell);rows.push(row)}return rows}
export function guessBucket(title:string):BucketId{if(/基金|理财|定投|储蓄|存款|应急/.test(title))return 'future';if(/书|课程|考试|教育|学费|培训|教材|旅行|机票|酒店|车票|数码|手机|电脑|咖啡|奶茶|电影|游戏|娱乐|聚餐|酒吧/.test(title))return 'experience';return 'living'}
function dateValue(v:unknown){if(v instanceof Date)return new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(v);const m=String(v).match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:''}
export function rowsToBills(raw:unknown[][],existing:Transaction[],filename:string){
 const clean=(v:unknown)=>String(v??'').replace(/^[\s\uFEFF]+|\s+$/g,'');
 const headerIndex=raw.findIndex(r=>r.some(x=>/交易时间|交易创建时间|付款时间|^日期$/.test(clean(x)))&&r.some(x=>/金额/.test(clean(x))));
 if(headerIndex<0)throw Error('没有找到日期和金额列。请使用微信、支付宝导出的 CSV / Excel，或下载示例模板。');
 const h=raw[headerIndex].map(clean);
 const col=(patterns:RegExp[])=>{for(const p of patterns){const i=h.findIndex(x=>p.test(x));if(i>=0)return i}return -1};
 const indices={date:col([/^交易时间$/,/交易创建时间/,/付款时间/,/^日期$/]),amount:col([/^金额/,/金额/]),title:col([/^商品$/,/商品名称/,/^说明$/,/交易对方/]),counterparty:col([/交易对方/]),direction:col([/^收.?支/,/^类型$/]),status:col([/交易状态/,/^当前状态$/]),type:col([/^交易类型$/,/交易分类/]),id:col([/^交易单号$/,/^交易订单号$/,/^支付宝交易号$/]),channel:col([/^支付方式$/,/^收.?付款方式$/,/^渠道$/])};
 const isWechat=h.some(x=>x==='交易单号')||/微信/.test(filename);
 const source=isWechat?'微信支付':h.some(x=>/支付宝|交易订单号/.test(x))||/支付宝/.test(filename)?'支付宝':'账单导入';
 let skipped=0;
 const seen=new Set(existing.map(t=>t.fingerprint).filter(Boolean));
 const seenId=new Set(existing.filter(t=>t.externalId).map(t=>`${t.channel}:${t.externalId}`));
 const rows:ImportRow[]=[];
 for(const r of raw.slice(headerIndex+1)){
  const get=(k:keyof typeof indices)=>indices[k]>=0?clean(r[indices[k]]):'';
  const date=dateValue(r[indices.date]);
  if(!date)continue;
  if(/失败|交易关闭|已关闭|已撤销/.test(get('status'))){skipped++;continue}
  let amount:number;
  try{amount=parseMoney(get('amount').replace(/^[-+]/,''))}catch{skipped++;continue}
  if(!amount){skipped++;continue}
  const rawTitle=get('title');
  const title=(rawTitle&&rawTitle!=='/'?rawTitle:get('counterparty')||'待确认交易').slice(0,100);
  const direction=get('direction'),type=get('type'),status=get('status');
  if(/转账|红包|充值|提现|还款/.test(type+' '+title)){skipped++;continue}
  const refund=/退款/.test(type+' '+title+' '+status);
  let kind:Transaction['kind'];
  if(refund)kind='income';
  else if(/支出|付款/.test(direction))kind='expense';
  else if(/收入|收款/.test(direction))kind='income';
  else{skipped++;continue}
  const channel=source==='账单导入'?(get('channel')||source):source;
  const externalId=get('id').replace(/\s/g,'');
  const fingerprint=externalId?`${channel}:${externalId}`:`${channel}:${String(r[indices.date])}:${title}:${amount}:${kind}`;
  const duplicate=seen.has(fingerprint)||(!!externalId&&seenId.has(`${channel}:${externalId}`));
  seen.add(fingerprint);
  if(externalId)seenId.add(`${channel}:${externalId}`);
  rows.push({id:crypto.randomUUID(),date,title,amount,kind,bucket:guessBucket(title),channel,externalId:externalId||undefined,fingerprint,selected:!duplicate,duplicate,note:refund?'退款按收入记录，未抵减原消费，请核对':'请核对归属账户'});
  if(rows.length>1000)throw Error('请每次导入不超过 1000 条记录，可按月份分批导出。');
 }
 if(!rows.length)throw Error('未找到可导入的支出或收入记录，请检查文件内容。');
 return {rows,skipped};
}
export async function readBills(file:File,existing:Transaction[]){if(file.size>8*1024*1024)throw Error('文件请控制在 8 MB 以内，可按月分批导出。');let rows:unknown[][];if(/\.xlsx$/i.test(file.name)){const {readSheet:readXlsxFile}=await import('read-excel-file/browser');rows=await readXlsxFile(file)}else if(/\.csv$/i.test(file.name)){const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer);if(text.includes('\uFFFD'))text=new TextDecoder('gb18030').decode(buffer);rows=parseCSV(text)}else throw Error('请选择 CSV 或 XLSX 文件；压缩包请先解压。');return rowsToBills(rows,existing,file.name)}
