import type { BucketId, Transaction } from './ledger';

export const expenseCategories = [
  { label: '餐饮', bucket: 'living', icon: 'food', match: /食堂|餐饮|午饭|早餐|晚饭|吃饭|外卖/ },
  { label: '购物', bucket: 'living', icon: 'shopping', match: /购物|衣服|服饰|淘宝/ },
  { label: '日用', bucket: 'living', icon: 'daily', match: /日用|超市|洗护/ },
  { label: '交通', bucket: 'living', icon: 'transport', match: /公交|地铁|交通|打车/ },
  { label: '蔬果', bucket: 'living', icon: 'fruit', match: /水果|蔬菜|买菜/ },
  { label: '零食', bucket: 'living', icon: 'snack', match: /零食|饮料|奶茶|咖啡/ },
  { label: '娱乐', bucket: 'experience', icon: 'fun', match: /电影|游戏|娱乐|演出/ },
  { label: '运动', bucket: 'experience', icon: 'sport', match: /运动|健身|球/ },
  { label: '住房', bucket: 'living', icon: 'housing', match: /住房|房租|住宿|水电/ },
  { label: '学习', bucket: 'experience', icon: 'study', match: /书|教材|课程|学习|考试|培训/ },
  { label: '医疗', bucket: 'living', icon: 'health', match: /医疗|医院|药|看病/ },
  { label: '社交', bucket: 'experience', icon: 'social', match: /社交|聚餐|朋友|礼物/ },
  { label: '旅行', bucket: 'experience', icon: 'travel', match: /旅行|机票|酒店|旅游/ },
  { label: '数码', bucket: 'experience', icon: 'digital', match: /数码|手机|电脑/ },
  { label: '通讯', bucket: 'living', icon: 'communication', match: /通讯|话费|网费/ },
  { label: '其他', bucket: 'living', icon: 'other', match: /其它|其他/ },
] satisfies { label: string; bucket: BucketId; icon: string; match: RegExp }[];

export const incomeCategories = [
  { label: '生活费', bucket: 'living', icon: 'allowance', match: /生活费/ },
  { label: '工资', bucket: 'living', icon: 'salary', match: /工资|薪/ },
  { label: '兼职', bucket: 'experience', icon: 'parttime', match: /兼职/ },
  { label: '奖学金', bucket: 'future', icon: 'award', match: /奖学金/ },
  { label: '礼金', bucket: 'living', icon: 'gift', match: /礼金|红包/ },
  { label: '其他', bucket: 'living', icon: 'other', match: /.*/ },
] satisfies { label: string; bucket: BucketId; icon: string; match: RegExp }[];

export function transactionCategory(t: Pick<Transaction, 'title' | 'kind' | 'category'>) {
  if (t.category) return t.category;
  if (t.kind === 'refund') return '退款';
  if (t.kind === 'transfer') return '历史转账';
  const categories = t.kind === 'income' ? incomeCategories : expenseCategories;
  return categories.find(c => c.match.test(t.title))?.label ?? '其他';
}

/** Keep cents arithmetic exact for the keypad's addition and subtraction. */
export function calculateEntry(expression: string): string {
  if (!/^\d+(?:\.\d{1,2})?(?:[+-]\d+(?:\.\d{1,2})?)*$/.test(expression)) {
    throw Error('请完成金额输入，最多两位小数');
  }
  const terms = expression.match(/[+-]?\d+(?:\.\d{1,2})?/g)!;
  const cents = terms.reduce((sum, term) => sum + Math.round(Number(term) * 100), 0);
  if (cents < 0) throw Error('金额计算结果不能小于零');
  if (cents > 100000000) throw Error('金额超出范围');
  return (cents / 100).toFixed(2);
}

export function appendEntry(expression: string, key: string) {
  if (key === 'backspace') return expression.slice(0, -1);
  if (key === '+' || key === '-') {
    if (!expression) return '';
    const normalized = expression.endsWith('.') ? expression + '00' : expression;
    return /[+-]$/.test(normalized) ? normalized.slice(0, -1) + key : normalized + key;
  }
  const current = expression.split(/[+-]/).at(-1) ?? '';
  if (key === '.') return current.includes('.') ? expression : expression + (current ? '.' : '0.');
  if (!/^\d$/.test(key) || expression.length >= 40 || (current.includes('.') && current.split('.')[1].length >= 2)) return expression;
  return current === '0' ? expression.slice(0, -1) + key : expression + key;
}
