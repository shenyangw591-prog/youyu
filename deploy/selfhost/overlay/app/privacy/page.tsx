import Link from 'next/link';
import '../selfhost.css';
export default function PrivacyPage() {
  return <main className="account-page"><article className="account-panel privacy-panel"><Link className="account-brand" href="/">有余</Link><h1>数据与隐私说明</h1><p>更新日期：2026 年 10 月 27 日</p>
    <h2>Android 本地版</h2><p>安装包不申请联网权限，预算、交易和目标由手机本地加密保存。换机前请导出 JSON 完整备份，卸载应用会删除本机账本。导出的备份文件没有加密，请自行妥善保存。</p>
    <h2>网页版账号</h2><p>注册需要账号和密码。服务器保存账号、带独立随机盐的密码派生值和你的账本数据；登录凭证通过 HttpOnly Cookie 保持。请求来源 IP 用于限制异常登录和注册频率。反向代理日志也可能记录 IP、访问时间和访问路径。</p>
    <h2>账本与账单导入</h2><p>网页版按账号读取和保存账本。账单原始 CSV/XLSX 文件在浏览器内解析，确认后的交易记录会保存到该账号账本。可在“我的”导出完整 JSON 备份。Android 本地版与网页版不会自动同步。</p>
    <h2>账号使用</h2><p>账号名不区分大小写，请妥善保存密码。当前没有手机号、邮箱验证或自助找回功能。忘记密码需要联系网站运营者处理。数据存储在本网站的阿里云服务器；请在决定注册前了解上述保存方式。</p>
    <h2>产品边界</h2><p>三个账户是规划分类。有余不连接支付账户，不索取支付密码，不代你转账或操作资金。预算与目标进度取决于你录入和确认的数据。</p><Link href="/login">返回登录 / 注册</Link></article></main>;
}
