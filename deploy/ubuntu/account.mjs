import { emitKeypressEvents } from 'node:readline';
import { getStore } from '../runtime/store.mjs';

async function hidden(prompt) {
  if (!process.stdin.isTTY) throw Error('Use an interactive server terminal; passwords are never accepted in command arguments.');
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    function finish(error) { process.stdin.off('keypress', listener); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); error ? reject(error) : resolve(value); }
    function listener(text, key) {
      if (key?.ctrl && key.name === 'c') return finish(Error('Cancelled'));
      if (key?.name === 'return') return finish();
      if (key?.name === 'backspace') { value = value.slice(0, -1); return; }
      if (!key?.ctrl && !key?.meta && text && !/[\r\n\x00-\x1f]/.test(text)) value += text;
    }
    process.stdin.on('keypress', listener);
  });
}
try {
  const username = process.argv[2];
  if (!username) throw Error('Usage: node ubuntu/account.mjs USERNAME');
  const password = await hidden('New password (hidden): '), confirm = await hidden('Repeat password (hidden): ');
  if (password !== confirm) throw Error('Passwords do not match');
  const store = getStore();
  try { await store.resetPassword(username, password); console.log('Password updated; previous sessions revoked.'); }
  finally { store.close(); }
} catch (error) { console.error(error.message); process.exitCode = 1; }
