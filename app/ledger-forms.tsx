'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Upload, Check, Download, Info, Utensils, ShoppingBag, BusFront, Package, House, Gamepad2, BookOpen, HeartPulse, Users, Ellipsis, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { BUCKETS, ACCOUNT_ART, type BucketId, type Ledger, type Transaction, type Goal, type Plan, parseMoney, money, splitPlan, newLedger, today, metrics, goalSaved, transactionSchema, goalSchema } from '@/lib/ledger';
import { readBills, type ImportRow } from '@/lib/import-bills';
import { LedgerDatePicker } from './ledger-date-picker';
export function Pick({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger className="field-select" aria-label={label}><SelectValue/></SelectTrigger><SelectContent position="popper">{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>}
export const bucketOptions=BUCKETS.map(b=>({value:b.id,label:b.name}));
export const kindOptions=[{value:'expense',label:'支出'},{value:'income',label:'收入'}];
function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="form-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
function useSubmit(action:()=>Promise<void>){const [error,setError]=useState(''),[busy,setBusy]=useState(false);const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setError('');setBusy(true);try{await action()}catch(e){setError(e instanceof Error?e.message:'操作未成功，请重试')}finally{setBusy(false)}};return {error,busy,submit}}
function Submit({busy,error,text='保存'}:{busy:boolean;error:string;text?:string}){return <>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary form-submit" type="submit" disabled={busy}>{busy?'正在保存…':text}{!busy&&<Check size={17}/>}</button></>}
export function SetupForm({onSave}:{onSave:(s:Ledger)=>Promise<void>}){const [name,setName]=useState('我的大学生活'),[income,setIncome]=useState('3000'),[payday,setPayday]=useState('1');const form=useSubmit(async()=>{const value=parseMoney(income);if(!value)throw Error('请填写本月可以安排的生活费');if(!name.trim())throw Error('请填写账本名称');const s=newLedger(name.trim(),value,Number(payday));const due=new Date(today()+'T00:00:00Z');due.setUTCMonth(due.getUTCMonth()+6);s.goals=[{id:crypto.randomUUID(),name:'先攒一份应急金',target:s.plans[today().slice(0,7)].amounts.living,initial:0,due:due.toISOString().slice(0,10),bucket:'future'}];await onSave(s)});return <form onSubmit={form.submit} className="form-stack"><Field label="账本名称"><Input value={name} onChange={e=>setName(e.target.value)} maxLength={30} required/></Field><Field label="本月可支配生活费（元）" hint="学费、住宿费若已另行支付，无需计入。"><Input inputMode="decimal" value={income} onChange={e=>setIncome(e.target.value)} required/></Field><Field label="每月生活费规划日"><Pick value={payday} onChange={setPayday} label="每月生活费规划日" options={Array.from({length:28},(_,i)=>({value:String(i+1),label:`每月 ${i+1} 日`}))}/></Field><div className="form-note"><Info size={17}/><p>先按 50 / 30 / 20 分配到三个账户，随后可自由调整。这是起始示例，优先照顾你的实际必要开支。</p></div><Submit {...form} text="建立我的账本"/></form>}
export function BudgetForm({state,period,onSave}:{state:Ledger;period:string;onSave:(p:Plan)=>Promise<void>}){
 const p=state.plans[period]??splitPlan(300000);
 const [income,setIncome]=useState(String(p.income/100));
 const [amounts,setAmounts]=useState<Record<BucketId,string>>(()=>Object.fromEntries(BUCKETS.map(b=>[b.id,(p.amounts[b.id]/100).toFixed(2)])) as Record<BucketId,string>);
 const ratio=(amount:number,base:number)=>base>0?(amount/base*100).toFixed(1).replace(/\.0$/,''):String(0);
 const [percents,setPercents]=useState<Record<BucketId,string>>(()=>Object.fromEntries(BUCKETS.map(b=>[b.id,p.income?ratio(p.amounts[b.id],p.income):String(b.ratio)])) as Record<BucketId,string>);
 const safeCents=(value:string)=>/^\d+(\.\d{0,2})?$/.test(value)?Math.round(Number(value)*100):null;
 const incomeCents=safeCents(income)??0;
 const allocatedCents=BUCKETS.reduce((sum,b)=>sum+(safeCents(amounts[b.id])??0),0);
 const totalPercent=BUCKETS.reduce((sum,b)=>sum+(Number(percents[b.id])||0),0);
 const remainingCents=incomeCents-allocatedCents;
 function amountsForPercent(base:number,values:Record<BucketId,string>){
  const entries=BUCKETS.map(b=>[b.id,Math.floor(base*(Number(values[b.id])||0)/100)] as const);
  const total=BUCKETS.reduce((sum,b)=>sum+(Number(values[b.id])||0),0);
  if(Math.abs(total-100)<0.001){const last=entries[entries.length-1];entries[entries.length-1]=[last[0],Math.max(0,base-entries.slice(0,-1).reduce((sum,[,cents])=>sum+cents,0))]}
  return Object.fromEntries(entries.map(([id,cents])=>[id,(cents/100).toFixed(2)])) as Record<BucketId,string>;
 }
 function updateIncome(value:string){
  setIncome(value);
  const base=safeCents(value);
  if(base===null)return;
  setAmounts(amountsForPercent(base,percents));
 }
 function updatePercent(id:BucketId,value:string){
  const next={...percents,[id]:value};
  setPercents(next);
  if(value===''){setAmounts(current=>({...current,[id]:''}));return}
  const percent=Number(value);
  if(!Number.isFinite(percent)||percent<0||percent>100)return;
  setAmounts(amountsForPercent(incomeCents,next));
 }
 function updateAmount(id:BucketId,value:string){
  setAmounts(current=>({...current,[id]:value}));
  const cents=safeCents(value);
  if(cents!==null&&incomeCents>0)setPercents(current=>({...current,[id]:ratio(cents,incomeCents)}));
  else if(value==='')setPercents(current=>({...current,[id]:''}));
 }
 function resetRatio(){
  try{
   const next=splitPlan(parseMoney(income));
   setAmounts(Object.fromEntries(BUCKETS.map(b=>[b.id,(next.amounts[b.id]/100).toFixed(2)])) as Record<BucketId,string>);
   setPercents(Object.fromEntries(BUCKETS.map(b=>[b.id,String(b.ratio)])) as Record<BucketId,string>);
  }catch{}
 }
 const form=useSubmit(async()=>{
  const plan={income:parseMoney(income),amounts:Object.fromEntries(BUCKETS.map(b=>[b.id,parseMoney(amounts[b.id])])) as Plan['amounts'],legacyAmounts:p.legacyAmounts};
  const sum=Object.values(plan.amounts).reduce((a,b)=>a+b,0);
  if(BUCKETS.some(b=>percents[b.id]===''||!Number.isFinite(Number(percents[b.id]))||Number(percents[b.id])<0||Number(percents[b.id])>100))throw Error('请填写 0 到 100 之间的分配百分比');
  if(totalPercent>100.01||sum>plan.income)throw Error('分配比例或金额超过 100%，请先调低部分账户');
  await onSave(plan);
 });
 return <form onSubmit={form.submit} className="form-stack allocation-editor">
  <div className="allocation-income"><span>本月可支配生活费</span><label><b>¥</b><Input value={income} inputMode="decimal" onChange={e=>updateIncome(e.target.value)} aria-label="本月可支配生活费" required/></label></div>
  <div className="allocation-actions"><span>调整百分比或金额，另一项会同步计算</span><button type="button" onClick={resetRatio}>恢复 50 / 30 / 20</button></div>
  <div className="allocation-rows">{BUCKETS.map(b=><div className={'allocation-account allocation-'+b.id} key={b.id}>
   <div className="allocation-identity"><span className="allocation-art"><img src={ACCOUNT_ART[b.id]} alt=""/></span><div><strong>{b.name}</strong><small>{b.description}</small></div></div>
   <div className="allocation-inputs"><label><span>分配比例</span><div><Input inputMode="decimal" value={percents[b.id]} onChange={e=>updatePercent(b.id,e.target.value)} onFocus={e=>e.currentTarget.select()} aria-label={b.name+'分配百分比'} required/><em>%</em></div></label><label><span>分配金额</span><div><em>¥</em><Input inputMode="decimal" value={amounts[b.id]} onChange={e=>updateAmount(b.id,e.target.value)} onFocus={e=>e.currentTarget.select()} aria-label={b.name+'分配金额'} required/></div></label></div>
   <span className="allocation-track"><i style={{width:`${Math.max(0,Math.min(100,Number(percents[b.id])||0))}%`}}/></span>
  </div>)}</div>
  <div className="allocation-summary"><div><span>已分配</span><strong>{totalPercent.toFixed(1).replace(/\.0$/,'')}% <small>· ¥{money(allocatedCents)}</small></strong></div><div><span>待分配</span><strong className={remainingCents<0?'danger':''}>¥{money(remainingCents)}</strong></div></div>
  <p className="form-help">这里是预算规划。只有在目标中确认“已存入”，才会记录储蓄进度。</p>
  <div className="allocation-submit"><Submit {...form} text="保存三账户分配"/></div>
 </form>
}
const quickCategories:{label:string;bucket:BucketId;icon:LucideIcon;className:string}[]=[
 {label:'餐饮',bucket:'living',icon:Utensils,className:'food'},
 {label:'购物',bucket:'living',icon:ShoppingBag,className:'shopping'},
 {label:'交通',bucket:'living',icon:BusFront,className:'transport'},
 {label:'日用',bucket:'living',icon:Package,className:'daily'},
 {label:'住房',bucket:'living',icon:House,className:'housing'},
 {label:'娱乐',bucket:'experience',icon:Gamepad2,className:'fun'},
 {label:'学习',bucket:'experience',icon:BookOpen,className:'study'},
 {label:'医疗',bucket:'living',icon:HeartPulse,className:'health'},
 {label:'社交',bucket:'experience',icon:Users,className:'social'},
 {label:'其他',bucket:'living',icon:Ellipsis,className:'other'},
];

export function TransactionForm({record,period,onSave}:{record?:Transaction;period:string;onSave:(t:Transaction)=>Promise<void>}){
 const [title,setTitle]=useState(record?.title??''),[amount,setAmount]=useState(record?String(record.amount/100):''),[date,setDate]=useState(record?.date??(today().startsWith(period)?today():period+'-01')),[kind,setKind]=useState(record?.kind??'expense'),[bucket,setBucket]=useState<BucketId>(record?.bucket??'living'),[selectedCategory,setSelectedCategory]=useState('');
 const form=useSubmit(async()=>{const t={...record,id:record?.id??crypto.randomUUID(),title:title.trim(),amount:parseMoney(amount),date,kind,bucket,channel:record?.channel??'手动记账'};const parsed=transactionSchema.safeParse(t);if(!parsed.success)throw Error('请填写有效的说明、日期和大于零的金额');await onSave(parsed.data)});
 function pressKey(key:string){if(key.startsWith('+')){setAmount(v=>((Number(v)||0)+Number(key.slice(1))).toFixed(2));return}if(key==='backspace'){setAmount(v=>v.slice(0,-1));return}if(key==='.') {setAmount(v=>v.includes('.')?v:(v||'0')+'.');return}setAmount(v=>v==='0'?key:v+key)}
 function pickCategory(label:string,budgetBucket:BucketId){if(!title||quickCategories.some(c=>c.label===title))setTitle(label);setBucket(budgetBucket);setSelectedCategory(label)}
 return <form className="form-stack quick-entry" onSubmit={form.submit}>
  <div className="kind-tabs" role="group" aria-label="收支类型">{kindOptions.map(option=><button type="button" key={option.value} className={kind===option.value?'selected':''} onClick={()=>setKind(option.value as Transaction['kind'])}>{option.label}</button>)}</div>
  <Field label="金额（元）"><Input className="quick-amount" value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)} required placeholder="0.00" aria-label="金额（元）"/></Field>
  <Field label="这笔钱用在哪里"><Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={100} placeholder="例如：和同学吃午饭" required/></Field>
  {(kind==='refund'||kind==='transfer')&&<p className="legacy-kind-note">这是旧版{kind==='refund'?'退款':'转账'}记录，历史金额仍会保留。要按现在的方式继续记录，请选择支出或收入。</p>}
  {kind==='expense'&&<div className="quick-categories"><span className="quick-label">常用类别</span><div className="quick-category-grid">{quickCategories.map(({label,bucket:categoryBucket,icon:Icon,className})=><button type="button" key={label} className={'quick-category '+className+(selectedCategory===label?' selected':'')} onClick={()=>pickCategory(label,categoryBucket)} aria-pressed={selectedCategory===label}><span><Icon size={22}/></span><b>{label}</b></button>)}</div></div>}
  <div className="form-two"><Field label="归属账户"><Pick value={bucket} onChange={v=>setBucket(v as BucketId)} options={bucketOptions} label="归属账户"/></Field><Field label="日期"><LedgerDatePicker value={date} onChange={setDate} label="选择记账日期"/></Field></div>
  <div className="quick-keypad" role="group" aria-label="金额快捷输入">{['1','2','3','+100','4','5','6','+50','7','8','9','+20','.','0','backspace'].map(key=><button type="button" key={key} onClick={()=>pressKey(key)} aria-label={key==='backspace'?'删除末位':key}>{key==='backspace'?'⌫':key}</button>)}</div>
  <p className="form-help">{kind==='income'?'收入记录不会自动增加本月预算，请在预算分配中确认可支配金额。':kind==='expense'?'记账后会扣减这笔消费所在月份的对应预算。':'旧版记录按原规则计算，不会新增此类记录。'}</p>
  <Submit {...form} text={record?'保存修改':'完成记账'}/>
 </form>
}
export function GoalForm({goal,onSave}:{goal?:Goal;onSave:(g:Goal)=>Promise<void>}){const future=new Date(today()+'T00:00:00Z');future.setUTCMonth(future.getUTCMonth()+3);const [name,setName]=useState(goal?.name??''),[target,setTarget]=useState(goal?String(goal.target/100):''),[initial,setInitial]=useState(goal?String(goal.initial/100):'0'),[due,setDue]=useState(goal?.due??future.toISOString().slice(0,10)),[bucket,setBucket]=useState<BucketId>(goal?.bucket??'future');const form=useSubmit(async()=>{const g={...goal,id:goal?.id??crypto.randomUUID(),name:name.trim(),target:parseMoney(target),initial:parseMoney(initial),due,bucket};const parsed=goalSchema.safeParse(g);if(!parsed.success)throw Error('请填写有效的名称、日期和大于零的目标金额');await onSave(parsed.data)});return <form onSubmit={form.submit} className="form-stack"><Field label="给目标起个名字"><Input value={name} onChange={e=>setName(e.target.value)} maxLength={50} placeholder="例如：寒假去看海" required/></Field><div className="form-two"><Field label="目标金额（元）"><Input value={target} inputMode="decimal" onChange={e=>setTarget(e.target.value)} required/></Field><Field label="此前已攒下（元）"><Input value={initial} inputMode="decimal" onChange={e=>setInitial(e.target.value)} required/></Field></div><Field label="计划完成日期"><LedgerDatePicker value={due} onChange={setDue} label="选择目标完成日期"/></Field><Field label="从哪个账户安排"><Pick value={bucket} onChange={v=>setBucket(v as BucketId)} options={bucketOptions} label="目标归属账户"/></Field><p className="form-help">此前已攒下的金额只记录一次，不含之后在此目标内确认的存入，也不会扣减本月预算。</p><Submit {...form} text={goal?'保存目标':'添加目标'}/></form>}
export function DepositForm({state,goal,period,onSave}:{state:Ledger;goal:Goal;period:string;onSave:(d:Ledger['deposits'][number])=>Promise<void>}){const [amount,setAmount]=useState(''),[date,setDate]=useState(today().startsWith(period)?today():period+'-01');const remaining=metrics(state,date.slice(0,7)).remaining[goal.bucket];const form=useSubmit(async()=>{const n=parseMoney(amount);if(n<=0)throw Error('存入金额需要大于零');if(n>remaining)throw Error('超过该账户可分配余额，请先调整当月预算');await onSave({id:crypto.randomUUID(),goalId:goal.id,amount:n,date,bucket:goal.bucket})});return <form onSubmit={form.submit} className="form-stack"><div className="form-note"><Info size={18}/><p>请在实际存好钱后确认。此操作只记录储蓄进度，不会操作微信、支付宝或银行卡。</p></div><Field label="确认已存入（元）"><Input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" required autoFocus/></Field><Field label="存入日期"><LedgerDatePicker value={date} onChange={setDate} label="选择存入日期"/></Field><p className="form-help">{BUCKETS.find(b=>b.id===goal.bucket)?.name}可安排 ¥{money(remaining)} · 目标还差 ¥{money(Math.max(0,goal.target-goalSaved(state,goal)))}</p><Submit {...form} text="确认这笔积累"/></form>}
function downloadTemplate(){const blob=new Blob(['\uFEFF日期,说明,金额,收支\n2026-10-01,食堂午饭,18.00,支出\n2026-10-02,书店购书,39.00,支出\n'],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='有余-账单导入示例.csv';a.click();URL.revokeObjectURL(url)}
export function ImportForm({state,onSave}:{state:Ledger;onSave:(t:Transaction[])=>Promise<void>}){const [rows,setRows]=useState<ImportRow[]>([]),[reading,setReading]=useState(false),[readError,setReadError]=useState(''),[filename,setFilename]=useState(''),[page,setPage]=useState(0),[skipped,setSkipped]=useState(0);const form=useSubmit(async()=>{const chosen=rows.filter(r=>r.selected&&!r.duplicate).map(({selected,duplicate,note,...r})=>r);if(!chosen.length)throw Error('请至少选择一条记录');const valid=chosen.every(t=>transactionSchema.safeParse(t).success);if(!valid)throw Error('部分记录的日期或金额无效，请取消选择后再导入');await onSave(chosen)});function update(id:string,patch:Partial<ImportRow>){setRows(old=>old.map(r=>r.id===id?{...r,...patch}:r))}return <form onSubmit={form.submit} className="form-stack"><label className="upload-zone"><Upload size={28}/><b>{reading?'正在识别账单…':'选择微信或支付宝账单'}</b><span>CSV / XLSX · 最大 8 MB · 每次最多 1000 条</span><Input type="file" accept=".csv,.xlsx" disabled={reading} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setReading(true);setReadError('');try{const result=await readBills(file,state.transactions);setRows(result.rows);setSkipped(result.skipped);setFilename(file.name);setPage(0)}catch(err){setReadError(err instanceof Error?err.message:'读取失败')}finally{setReading(false);e.target.value=''}}}/></label><p className="form-help">请先在支付 App 中导出账单并解压。原始文件仅在浏览器中读取，确认后的记录才会保存到你的账本。</p><button className="text-button" type="button" onClick={downloadTemplate}><Download size={15}/>下载 CSV 示例模板</button>{readError&&<p className="form-error" role="alert">{readError}</p>}{rows.length>0&&<><div className="import-summary"><b>{filename}</b><span>{rows.length} 条记录 · 重复 {rows.filter(r=>r.duplicate).length} 条 · 跳过 {skipped} 条转账、还款或无效记录</span></div><p className="form-note">请逐页核对支出、收入与归属账户。转账和还款会自动跳过；退款按收入导入并标注，未识别的消费暂归安全账户。</p><div className="import-table"><Table><TableHeader><TableRow><TableHead>选取</TableHead><TableHead>交易</TableHead><TableHead>金额</TableHead><TableHead>类型</TableHead><TableHead>账户</TableHead></TableRow></TableHeader><TableBody>{rows.slice(page*10,page*10+10).map(r=><TableRow key={r.id} className={r.duplicate?'duplicate-row':''}><TableCell><Checkbox aria-label={`选取 ${r.title}`} checked={r.selected} disabled={r.duplicate} onCheckedChange={v=>update(r.id,{selected:!!v})}/></TableCell><TableCell><b>{r.title}</b><small>{r.date} · {r.duplicate?'重复记录':r.note}</small></TableCell><TableCell>¥{money(r.amount)}</TableCell><TableCell><Pick value={r.kind} onChange={v=>update(r.id,{kind:v as Transaction['kind']})} options={kindOptions} label={`${r.title}的类型`}/></TableCell><TableCell><Pick value={r.bucket} onChange={v=>update(r.id,{bucket:v as BucketId})} options={bucketOptions} label={`${r.title}的账户`}/></TableCell></TableRow>)}</TableBody></Table></div><div className="pagination-line"><button type="button" className="btn btn-white" disabled={page===0} onClick={()=>setPage(page-1)}>上一页</button><span>{page+1} / {Math.ceil(rows.length/10)}</span><button type="button" className="btn btn-white" disabled={(page+1)*10>=rows.length} onClick={()=>setPage(page+1)}>下一页</button></div><Submit {...form} text={`确认导入 ${rows.filter(r=>r.selected&&!r.duplicate).length} 条`}/></>}</form>}
