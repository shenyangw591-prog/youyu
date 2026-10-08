import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import SiteMotion from './site-motion';
import './site.css';

export const metadata: Metadata = {
  title: '有余 · 把今天过好，也把以后安排好',
  description: '有余，帮年轻人从容安排生活费。分配、记录、积累，都从自己的节奏开始。',
};

const accounts = [
  { name: '安全账户', text: '先安放每天必需的开支。', image: '/marketing/account-safety.webp' },
  { name: '体验账户', text: '为喜欢的事留一点空间。', image: '/marketing/account-experience.webp' },
  { name: '财富账户', text: '把一点点积累留给以后。', image: '/marketing/account-wealth.webp' },
];

const questions = [
  {
    question: '有余会关联微信或支付宝吗？',
    answer: '不会。有余不实时关联支付账户，也不会自动获取每笔支付。你可以手动记账，或自行导出账单后导入。',
  },
  {
    question: '账单怎么导入？',
    answer: '先在微信或支付宝导出并解压账单文件，再将 CSV 或 XLSX 文件导入有余，预览、核对分类和重复记录后确认。原始文件在浏览器内读取。',
  },
  {
    question: '三个账户里的钱是真的吗？',
    answer: '三个账户是生活费规划分类，不是银行账户。有余不索取支付密码，也不转账或操作真实资金。目标进度由你确认记录。',
  },
  {
    question: '提醒会推送到手机吗？',
    answer: '当前提供站内提醒，打开有余时可以查看。关闭页面后不会发送系统推送。',
  },
];

export default function IntroPage() {
  return (
    <main className="youyu-site">
      <SiteMotion />
      <section className="site-hero" aria-labelledby="hero-title">
        <div className="site-hero-inner">
          <header className="site-header">
            <Link className="site-logo" href="/intro" aria-label="有余产品官网首页">
              <img src="/marketing/brand-mark-imagegen.webp" alt="" width="40" height="40" />
              <span>有余</span>
            </Link>
          </header>
          <div className="hero-copy">
            <span className="hero-eyebrow">为年轻人的生活费，留一份从容</span>
            <h1 id="hero-title">把今天过好，<br />也把以后安排好。</h1>
            <p>生活费有方向，日子也更从容。</p>
            <Link className="site-primary" href="/" aria-label="体验有余演示账本">
              体验有余 <ArrowUpRight size={19} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </div>
          <div className="hero-process" aria-hidden="true">
            <span><b>01</b> 分配</span><i />
            <span><b>02</b> 记录</span><i />
            <span><b>03</b> 积累</span>
          </div>
          <div className="hero-product" aria-label="有余真实手机界面预览">
            <img className="hero-held-photo" src="/marketing/hero-held-phone-imagegen.webp" alt="" width="1024" height="1536" aria-hidden="true" fetchPriority="high" />
            <div className="hero-held-display">
              <img src="/marketing/app-home.webp" alt="手持手机正在使用有余，本月概览与三个规划账户清晰可见" width="390" height="933" fetchPriority="high" />
            </div>
          </div>
        </div>
      </section>

      <section className="site-section accounts-section" aria-labelledby="accounts-title">
        <div className="section-inner">
          <div className="section-intro" data-reveal>
            <span className="section-index">01 / 从容分配</span>
            <h2 id="accounts-title">生活费，<br />有自己的去处。</h2>
            <p>给日常、喜欢的事和未来，各留一个位置。</p>
          </div>
          <div className="account-list">
            {accounts.map((account, index) => (
              <div className="account-item" key={account.name} data-reveal>
                <span className="account-count">0{index + 1}</span>
                <img src={account.image} alt="" width="112" height="112" loading="lazy" />
                <div>
                  <h3>{account.name}</h3>
                  <p>{account.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section record-section" aria-labelledby="record-title">
        <div className="section-inner record-layout">
          <div className="record-copy" data-reveal>
            <span className="section-index">02 / 轻松记录</span>
            <h2 id="record-title">记录日常，<br />看见余量。</h2>
            <p>随手记一笔，账单也能导入核对。</p>
            <Link className="site-text-link" href="/" aria-label="打开有余演示账本体验记账">去演示账本看看 <ChevronRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className="record-visual" aria-label="有余记账使用场景" data-reveal>
            <figure className="record-use-photo">
              <img className="record-use-backdrop" src="/marketing/record-cafe-integrated-imagegen.webp" alt="在咖啡馆用有余记录日常开销的场景" width="1122" height="1402" loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      <section className="site-section goal-section" aria-labelledby="goal-title">
        <div className="section-inner goal-layout">
          <div className="goal-visual" data-reveal>
            <figure className="goal-photo">
              <img className="goal-backdrop" src="/marketing/goal-airplane-complete-imagegen.svg" alt="在飞机上用有余查看已完成的旅行目标" width="1448" height="1086" loading="lazy" />
            </figure>
          </div>
          <div className="goal-copy" data-reveal>
            <span className="section-index">03 / 慢慢积累</span>
            <h2 id="goal-title">为想要的生活，<br />慢慢积累。</h2>
            <p>想去的地方，想做的事，都从今天开始。</p>
          </div>
        </div>
      </section>

      <section className="site-close" aria-labelledby="close-title">
        <div className="section-inner" data-reveal>
          <h2 id="close-title">从今天开始，<br />给生活留点余地。</h2>
          <Link className="site-primary" href="/" aria-label="体验有余演示账本">
            体验有余 <ArrowUpRight size={19} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="site-faq" aria-labelledby="faq-title">
        <div className="section-inner faq-layout" data-reveal>
          <div>
            <span className="section-index">了解更多</span>
            <h2 id="faq-title">常见问题</h2>
          </div>
          <div className="faq-list">
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}<span aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <span>有余 · 让每一天，都更有余地</span>
        <Link href="/">体验演示账本 <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
