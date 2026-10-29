import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { normalizeApkPaths } from './normalize-apk-paths.mjs';

const project = fileURLToPath(new URL('..', import.meta.url));
const release = JSON.parse(readFileSync(path.join(project, 'mobile/release.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(release.versionName) || !Number.isSafeInteger(release.versionCode)) throw Error('Invalid release version');
if (release.packageId !== 'com.youyu.ledger') throw Error('Keep the permanent production application ID');
const toolRoot = path.resolve(project, '../.tmp/android-beta-tools');
function oneDirectory(root, probe) {
  const hit = existsSync(root) && readdirSync(root).map(name => path.join(root, name)).find(dir => existsSync(path.join(dir, probe)));
  if (!hit) throw Error(`Missing Android tool: ${probe}`);
  return hit;
}
const javaHome = process.env.JAVA_HOME || oneDirectory(path.join(toolRoot, 'jdk'), 'bin/java.exe');
const platform = process.env.YOUYU_ANDROID_PLATFORM || oneDirectory(path.join(toolRoot, 'platform'), 'android.jar');
const buildTools = process.env.YOUYU_ANDROID_BUILD_TOOLS || oneDirectory(path.join(toolRoot, 'build-tools'), 'aapt2.exe');
const androidJar = path.join(platform, 'android.jar');
const build = path.join(project, 'mobile/android-build/release');
const source = path.join(project, 'mobile/android');
const web = path.join(project, 'mobile-dist');
const output = path.resolve(project, '../安卓正式版');
const signing = path.join(source, 'signing');
const signature = path.join(signing, 'youyu-release.p12');
const secretFile = path.join(signing, 'release-credentials.json');
const env = { ...process.env, JAVA_HOME: javaHome, PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH}` };
function run(executable, args, cwd = project, capture = false) {
  const portableArgs = args.map(arg => path.isAbsolute(arg) ? path.relative(cwd, arg) : arg);
  const result = spawnSync(executable, portableArgs, { cwd, env, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`Android build failed: ${path.basename(executable)}\n${result.stderr || ''}`);
  return result.stdout || '';
}
function files(root, extension) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(root, entry.name), extension) : entry.name.endsWith(extension) ? [path.join(root, entry.name)] : []);
}
if (!existsSync(path.join(web, 'index.html'))) throw Error('Build mobile web assets first');
mkdirSync(build, { recursive: true });
for (const relative of ['source', 'assets/web', 'generated', 'classes', 'dex', 'asset-test']) {
  const target = path.resolve(build, relative);
  if (!target.startsWith(build + path.sep)) throw Error('Build staging path outside release directory');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
}
mkdirSync(output, { recursive: true });
mkdirSync(signing, { recursive: true });
cpSync(web, path.join(build, 'assets/web'), { recursive: true });
cpSync(path.join(source, 'res'), path.join(build, 'source/res'), { recursive: true });
const originalPackage = 'com.youyu.ledger.beta';
for (const input of files(path.join(source, 'src'), '.java')) {
  const target = path.join(build, 'source/src', path.basename(input));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(input, 'utf8').replaceAll(originalPackage, release.packageId).replaceAll('0.1.2', release.versionName));
}
const manifest = readFileSync(path.join(source, 'AndroidManifest.xml'), 'utf8')
  .replace(originalPackage, release.packageId)
  .replace(/android:versionCode="[^"]+"/, `android:versionCode="${release.versionCode}"`)
  .replace(/android:versionName="[^"]+"/, `android:versionName="${release.versionName}"`)
  .replace('有余·内测', '有余');
writeFileSync(path.join(build, 'source/AndroidManifest.xml'), manifest);
run(path.join(buildTools, 'aapt2.exe'), ['compile', '--dir', path.join(build, 'source/res'), '-o', path.join(build, 'compiled-res.zip')]);
run(path.join(buildTools, 'aapt2.exe'), ['link', '-o', path.join(build, 'unsigned.apk'), '--manifest', path.join(build, 'source/AndroidManifest.xml'), '-I', androidJar, '--java', path.join(build, 'generated'), '-A', path.join(build, 'assets'), '--min-sdk-version', '26', '--target-sdk-version', '35', path.join(build, 'compiled-res.zip')]);
run(path.join(javaHome, 'bin/javac.exe'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', androidJar, '-d', path.join(build, 'classes'), ...files(path.join(build, 'source/src'), '.java'), ...files(path.join(build, 'generated'), '.java')]);
run(path.join(javaHome, 'bin/java.exe'), ['-cp', path.join(buildTools, 'lib/d8.jar'), 'com.android.tools.r8.D8', '--lib', androidJar, '--min-api', '26', '--output', path.join(build, 'dex'), ...files(path.join(build, 'classes'), '.class')]);
run(path.join(buildTools, 'aapt.exe'), ['add', path.join(build, 'unsigned.apk'), 'classes.dex'], path.join(build, 'dex'));
normalizeApkPaths(path.join(build, 'unsigned.apk'));
run(path.join(buildTools, 'zipalign.exe'), ['-f', '4', path.join(build, 'unsigned.apk'), path.join(build, 'aligned.apk')]);
if (existsSync(signature) !== existsSync(secretFile)) throw Error('Release signing material is incomplete. Restore both original files before building.');
if (!existsSync(signature)) {
  const password = randomBytes(36).toString('base64url');
  env.YOUYU_RELEASE_STORE_PASSWORD = password;
  env.YOUYU_RELEASE_KEY_PASSWORD = password;
  run(path.join(javaHome, 'bin/keytool.exe'), ['-genkeypair', '-storetype', 'PKCS12', '-keystore', signature, '-storepass:env', 'YOUYU_RELEASE_STORE_PASSWORD', '-keypass:env', 'YOUYU_RELEASE_KEY_PASSWORD', '-alias', 'youyu-release', '-dname', 'CN=Youyu Release,OU=Mobile,O=Youyu,C=CN', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000']);
  writeFileSync(secretFile, JSON.stringify({ alias: 'youyu-release', storePassword: password, keyPassword: password }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
} else {
  const credentials = JSON.parse(readFileSync(secretFile, 'utf8'));
  if (credentials.alias !== 'youyu-release') throw Error('Unexpected release key alias');
  env.YOUYU_RELEASE_STORE_PASSWORD = credentials.storePassword;
  env.YOUYU_RELEASE_KEY_PASSWORD = credentials.keyPassword;
}
// Older Android Windows tools require an ASCII relative filename.
const apk = path.join(build, 'youyu-release.apk');
run(path.join(javaHome, 'bin/java.exe'), ['-jar', path.join(buildTools, 'lib/apksigner.jar'), 'sign', '--ks', signature, '--ks-key-alias', 'youyu-release', '--ks-pass', 'env:YOUYU_RELEASE_STORE_PASSWORD', '--key-pass', 'env:YOUYU_RELEASE_KEY_PASSWORD', '--out', apk, path.join(build, 'aligned.apk')]);
const certificate = run(path.join(javaHome, 'bin/java.exe'), ['-jar', path.join(buildTools, 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', apk], project, true);
if (/Android Debug|Youyu Android Beta/i.test(certificate) || !certificate.includes('Youyu Release')) throw Error('APK must use the permanent release certificate');
run(path.join(buildTools, 'zipalign.exe'), ['-c', '4', apk]);
const badging = run(path.join(buildTools, 'aapt.exe'), ['dump', 'badging', apk], project, true);
if (!badging.includes(`name='${release.packageId}'`) || !badging.includes(`versionName='${release.versionName}'`) || !badging.includes(`versionCode='${release.versionCode}'`) || badging.includes('application-debuggable') || /内测|beta/i.test(badging)) throw Error('Invalid release manifest');
const smoke = path.join(build, 'source/BundledAssetsSmokeTest.java');
writeFileSync(smoke, readFileSync(path.join(project, 'tests/android/BundledAssetsSmokeTest.java'), 'utf8').replaceAll(originalPackage, release.packageId));
run(path.join(javaHome, 'bin/javac.exe'), ['-encoding', 'UTF-8', '-d', path.join(build, 'asset-test'), path.join(build, 'source/src/BundledAssets.java'), smoke]);
run(path.join(javaHome, 'bin/java.exe'), ['-cp', path.join(build, 'asset-test'), `${release.packageId}.BundledAssetsSmokeTest`, apk]);
const hash = createHash('sha256').update(readFileSync(apk)).digest('hex');
const deliveredApk = path.join(output, `有余-${release.versionName}.apk`);
copyFileSync(apk, deliveredApk);
const info = { ...release, filename: `youyu-${release.versionName}.apk`, sha256: hash, bytes: readFileSync(apk).length, storage: 'offline', publishedAt: '2026-10-27' };
writeFileSync(path.join(output, 'SHA256.txt'), `${hash}  有余-${release.versionName}.apk\n`);
writeFileSync(path.join(output, 'release.json'), JSON.stringify(info, null, 2) + '\n');
const downloads = path.join(project, 'public/downloads');
mkdirSync(downloads, { recursive: true });
copyFileSync(apk, path.join(downloads, info.filename));
writeFileSync(path.join(downloads, 'release.json'), JSON.stringify(info, null, 2) + '\n');
writeFileSync(path.join(downloads, 'SHA256.txt'), `${hash}  ${info.filename}\n`);
writeFileSync(path.join(output, '正式版安装说明.md'), `# 有余 ${release.versionName}\n\n正式版应用 ID：${release.packageId}，Android ${release.minAndroid} 及以上。使用独立正式签名，调试关闭。安装后仍采用本机加密账本，无需账号，可离线使用，与网页版账号账本不自动同步。\n\n从旧内测版迁移：在旧应用“我的”导出 JSON 完整备份，安装正式版，在正式版“我的”恢复备份；核对记录后再处理旧应用。两个应用可以同时保留。\n\n网页下载文件：${info.filename}\nSHA-256：${hash}\n\n签名资料保存在项目 mobile/android/signing/youyu-release.p12 和 release-credentials.json；后续更新必须保留原签名和应用 ID，并提高 versionCode。签名资料不要上传到网站或提交到 Git。\n\n已完成构建、清单、正式签名、ZIP 对齐和最终 APK 内资源读取检查。首次安装、备份恢复、文件选择、键盘和系统返回键仍需在真机上验收。\n`);
console.log(JSON.stringify({ apk: deliveredApk, version: release.versionName, packageId: release.packageId, sha256: hash, bytes: info.bytes, signature: 'release', debuggable: false }, null, 2));
