export default function IcpFooter() {
  const number = process.env.YOUYU_ICP_NUMBER?.trim();
  if (!number) return null;
  return <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{number}</a>;
}
