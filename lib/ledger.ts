import { z } from 'zod';
export const BUCKETS = [
 {id:'living',name:'安全账户',color:'#008b61',ratio:50,description:'餐饮、交通、住房与必要开支'},
 {id:'experience',name:'体验账户',color:'#16b888',ratio:30,description:'学习、旅行、社交与喜欢的生活'},
 {id:'future',name:'财富账户',color:'#83cb45',ratio:20,description:'应急储蓄与长期目标'},
] as const;
export type BucketId=typeof BUCKETS[number]['id'];
export const ACCOUNT_ART:Record<BucketId,string>={living:'/account-safety.png',experience:'/account-experience.png',future:'/account-wealth.png'};
const bid=z.enum(['living','experience','future']);
const legacyBid=z.enum(['living','planned','fun','growth','emergency','future']);
const cents=z.number().int().min(0).max(100000000);
const id=z.string().min(1).max(120);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T00:00:00Z');return !isNaN(+d)&&d.toISOString().slice(0,10)===s},'日期无效');
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const transactionSchema=z.object({id,date,title:z.string().trim().min(1).max(100),amount:cents.refine(n=>n>0),kind:z.enum(['expense','refund','income','transfer']),bucket:bid,legacyBucket:legacyBid.optional(),channel:z.string().max(30),externalId:z.string().max(150).optional(),fingerprint:z.string().max(300).optional()});
export const goalSchema=z.object({id,name:z.string().trim().min(1).max(50),target:cents.refine(n=>n>0),initial:cents,due:date,bucket:bid,legacyBucket:legacyBid.optional()});
const legacyAmounts=z.object({living:cents,planned:cents,fun:cents,growth:cents,emergency:cents,future:cents});
export const planSchema=z.object({income:cents,amounts:z.object({living:cents,experience:cents,future:cents}),legacyAmounts:legacyAmounts.optional()}).refine(p=>Object.values(p.amounts).reduce((a,b)=>a+b,0)<=p.income,'分配金额不能超过本月生活费');
const canonicalLedgerSchema=z.object({name:z.string().trim().min(1).max(30),payday:z.number().int().min(1).max(28),plans:z.record(month,planSchema),transactions:z.array(transactionSchema).max(5000),goals:z.array(goalSchema).max(50),deposits:z.array(z.object({id,goalId:id,amount:cents.refine(n=>n>0),date,bucket:bid,legacyBucket:legacyBid.optional()})).max(5000),reminders:z.object({payday:z.boolean(),weekly:z.boolean(),budget:z.boolean(),goals:z.boolean(),threshold:z.number().int().min(50).max(100)}),lastImport:z.string().max(40).nullable()}).superRefine((s,ctx)=>{for(const key of ['transactions','goals','deposits'] as const){const ids=s[key].map(x=>x.id);if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'记录编号重复',path:[key]})}if(s.deposits.some(d=>!s.goals.some(g=>g.id===d.goalId)))ctx.addIssue({code:'custom',message:'储蓄目标不存在'})});
const legacyToAccount:Record<string,BucketId>={living:'living',planned:'experience',fun:'experience',growth:'experience',emergency:'future',future:'future',experience:'experience'};
function migrateLegacyLedger(value:unknown):unknown{
 if(!value||typeof value!=='object')return value;
 const raw=value as Record<string,unknown>;
 const plans=raw.plans&&typeof raw.plans==='object'?raw.plans as Record<string,unknown>:{};
 const hadLegacyPlan=Object.values(plans).some(value=>value&&typeof value==='object'&&'amounts' in value&&!!value.amounts&&typeof value.amounts==='object'&&'planned' in value.amounts);
 const migratedPlans=Object.fromEntries(Object.entries(plans).map(([period,value])=>{
  if(!value||typeof value!=='object')return [period,value];
  const plan=value as Record<string,unknown>;
  if(!plan.amounts||typeof plan.amounts!=='object')return [period,value];
  const amounts=plan.amounts as Record<string,unknown>;
  if(!('planned' in amounts||'fun' in amounts||'growth' in amounts||'emergency' in amounts))return [period,value];
  const n=(key:string)=>typeof amounts[key]==='number'?amounts[key] as number:NaN;
  return [period,{...plan,legacyAmounts:amounts,amounts:{living:n('living'),experience:n('planned')+n('fun')+n('growth'),future:n('emergency')+n('future')}}];
 }));
 const mapItems=(value:unknown)=>Array.isArray(value)?value.map(item=>{
  if(!item||typeof item!=='object')return item;
  const record=item as Record<string,unknown>;
  const oldBucket=record.bucket;
  const legacyBucket=record.legacyBucket??(hadLegacyPlan&&typeof oldBucket==='string'&&['living','planned','fun','growth','emergency','future'].includes(oldBucket)?oldBucket:undefined);
  return {...record,...(legacyBucket?{legacyBucket}:{}),bucket:typeof oldBucket==='string'?legacyToAccount[oldBucket]??oldBucket:oldBucket};
 }):value;
 return {...raw,plans:migratedPlans,transactions:mapItems(raw.transactions),goals:mapItems(raw.goals),deposits:mapItems(raw.deposits)};
}
export const ledgerSchema=z.preprocess(migrateLegacyLedger,canonicalLedgerSchema);
export type Ledger=z.infer<typeof ledgerSchema>;
export type Transaction=z.infer<typeof transactionSchema>;
export type Goal=z.infer<typeof goalSchema>;
export type Plan=z.infer<typeof planSchema>;
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function money(n:number,decimal=true){return (n/100).toLocaleString('zh-CN',{minimumFractionDigits:decimal?2:0,maximumFractionDigits:2})}
export function parseMoney(value:string){const normalized=value.replace(/[¥￥,，\s]/g,'');if(!/^\d+(\.\d{1,2})?$/.test(normalized))throw new Error('请输入有效金额，最多两位小数');const n=Math.round(Number(normalized)*100);if(!Number.isSafeInteger(n)||n>100000000)throw new Error('金额超出范围');return n}
export function splitPlan(income:number):Plan{let rest=income;const amounts={} as Plan['amounts'];BUCKETS.forEach((b,i)=>{amounts[b.id]=i===BUCKETS.length-1?rest:Math.floor(income*b.ratio/100);rest-=amounts[b.id]});return {income,amounts}}
export function newLedger(name:string,income:number,payday:number,period=today().slice(0,7)):Ledger{const p=splitPlan(income);return {name,payday,plans:{[period]:p},transactions:[],goals:[],deposits:[],lastImport:null,reminders:{payday:true,weekly:true,budget:true,goals:true,threshold:80}}}
export function metrics(s:Ledger,period:string){const plan=s.plans[period]??splitPlan(0);const spent=Object.fromEntries(BUCKETS.map(b=>[b.id,0])) as Record<BucketId,number>;const deposited={...spent};let income=0;for(const t of s.transactions.filter(t=>t.date.startsWith(period))){if(t.kind==='expense')spent[t.bucket]+=t.amount;else if(t.kind==='refund')spent[t.bucket]-=t.amount;else if(t.kind==='income')income+=t.amount}for(const d of s.deposits.filter(d=>d.date.startsWith(period)))deposited[d.bucket]+=d.amount;const remaining=Object.fromEntries(BUCKETS.map(b=>[b.id,plan.amounts[b.id]-spent[b.id]-deposited[b.id]])) as Record<BucketId,number>;return {plan,spent,deposited,remaining,income,totalSpent:Object.values(spent).reduce((a,b)=>a+b,0),consumerBudget:plan.amounts.living+plan.amounts.experience,consumerLeft:remaining.living+remaining.experience,reserved:plan.amounts.future}}
export function goalSaved(s:Ledger,g:Goal){return g.initial+s.deposits.filter(d=>d.goalId===g.id).reduce((a,b)=>a+b.amount,0)}
export function monthsUntil(due:string,now=today()){const a=new Date(now),b=new Date(due);return Math.max(1,(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth()+1)}
export function demoLedger():Ledger{const now=today(),p=now.slice(0,7);const s=newLedger('我的大学生活',300000,1,p);const samples:[string,number,BucketId][]=[['校园食堂',1800,'living'],['一本想读的书',3900,'experience'],['和朋友喝咖啡',2800,'experience'],['超市补充日用品',6800,'living'],['校园餐饮',32000,'living'],['公交与地铁',8000,'living'],['周末看电影',5800,'experience']];s.transactions=samples.map(([title,amount,bucket],i)=>({id:'demo-'+i,date:p+'-'+String(Math.max(1,Number(now.slice(-2))-Math.floor(i/2))).padStart(2,'0'),title,amount,bucket,kind:'expense',channel:i%2?'支付宝':'微信支付'}));const due=new Date(now+'T00:00:00Z');due.setUTCMonth(due.getUTCMonth()+3);s.goals=[{id:'demo-goal',name:'寒假，去看看海',target:200000,initial:80000,due:due.toISOString().slice(0,10),bucket:'experience'},{id:'demo-emergency',name:'给自己一份安心',target:150000,initial:45000,due:due.toISOString().slice(0,10),bucket:'future'}];return s}
export function reminders(s:Ledger,period:string){const m=metrics(s,period),r:{title:string;detail:string;tone:string}[]=[];if(!s.plans[period])r.push({title:'这个月还没有分配生活费',detail:'先确定必要开支，再给目标留一点空间。',tone:'info'});if(s.reminders.budget)for(const b of BUCKETS){const used=m.spent[b.id]+m.deposited[b.id],budget=m.plan.amounts[b.id];if(used>0&&(budget===0||used/budget*100>=s.reminders.threshold))r.push({title:m.remaining[b.id]<0?`${b.name}已超出预算`:`${b.name}预算接近用完`,detail:`本月剩余 ¥${money(m.remaining[b.id])}，可以调整预算或放慢消费。`,tone:'warn'})}const now=today();if(s.reminders.payday&&Number(now.slice(-2))===s.payday)r.push({title:'今天是生活费规划日',detail:'确认生活费到账后，检查本月分配。',tone:'info'});if(s.reminders.weekly&&new Date(now+'T12:00:00Z').getUTCDay()===0)r.push({title:'花几分钟，回顾这一周',detail:'补记遗漏的消费，看看下周可以怎样安排。',tone:'info'});if(s.reminders.goals)for(const g of s.goals){const left=g.target-goalSaved(s,g);if(left>0&&g.due<=new Date(Date.now()+30*86400000).toISOString().slice(0,10))r.push({title:`「${g.name}」${g.due<now?'已到计划日期':'快到计划日期'}`,detail:`还差 ¥${money(left)}，可以继续积累或调整目标日期。`,tone:'info'})}return r}
