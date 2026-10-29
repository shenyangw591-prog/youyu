import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { normalizeApkPaths } from './normalize-apk-paths.mjs';

const project = fileURLToPath(new URL('..', import.meta.url));
const toolRoot = path.resolve(project, '../.tmp/android-beta-tools');
function oneDirectory(root, probe) {
  const hit = existsSync(root) && readdirSync(root).map(name => path.join(root, name)).find(dir => existsSync(path.join(dir, probe)));
  if (!hit) throw new Error(`Missing Android tool: ${probe}. See mobile/README.md.`);
  return hit;
}
const javaHome = process.env.JAVA_HOME || oneDirectory(path.join(toolRoot, 'jdk'), 'bin/java.exe');
const platform = process.env.YOUYU_ANDROID_PLATFORM || oneDirectory(path.join(toolRoot, 'platform'), 'android.jar');
const buildTools = process.env.YOUYU_ANDROID_BUILD_TOOLS || oneDirectory(path.join(toolRoot, 'build-tools'), 'aapt2.exe');
const androidJar = path.join(platform, 'android.jar');
const build = path.join(project, 'mobile/android-build');
const source = path.join(project, 'mobile/android');
const web = path.join(project, 'mobile-dist');
const output = path.resolve(project, '../安卓内测版');
const signature = path.join(source, 'signing/youyu-beta-debug.keystore');
const env = { ...process.env, JAVA_HOME: javaHome, PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH}` };
function run(executable, args, cwd = project) {
  const portableArgs = args.map(arg => path.isAbsolute(arg) ? path.relative(cwd, arg) : arg);
  const result = spawnSync(executable, portableArgs, { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Android build failed: ${path.basename(executable)}`);
}
function files(root, extension) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(root, entry.name), extension) : entry.name.endsWith(extension) ? [path.join(root, entry.name)] : []);
}
if (!existsSync(path.join(web, 'index.html'))) throw new Error('Build mobile web assets first.');
for (const directory of [build, output, path.dirname(signature), path.join(build, 'assets/web'), path.join(build, 'generated'), path.join(build, 'classes'), path.join(build, 'dex')]) mkdirSync(directory, { recursive: true });
for (const relative of ['assets/web', 'generated', 'classes', 'dex']) {
  const target = path.resolve(build, relative);
  if (!target.startsWith(build + path.sep)) throw new Error('Build staging path outside project');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
}
cpSync(web, path.join(build, 'assets/web'), { recursive: true });
run(path.join(buildTools, 'aapt2.exe'), ['compile', '--dir', path.join(source, 'res'), '-o', path.join(build, 'compiled-res.zip')]);
run(path.join(buildTools, 'aapt2.exe'), ['link', '-o', path.join(build, 'unsigned.apk'), '--manifest', path.join(source, 'AndroidManifest.xml'), '-I', androidJar, '--java', path.join(build, 'generated'), '-A', path.join(build, 'assets'), '--min-sdk-version', '26', '--target-sdk-version', '35', path.join(build, 'compiled-res.zip')]);
run(path.join(javaHome, 'bin/javac.exe'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', androidJar, '-d', path.join(build, 'classes'), ...files(path.join(source, 'src'), '.java'), ...files(path.join(build, 'generated'), '.java')]);
run(path.join(javaHome, 'bin/java.exe'), ['-cp', path.join(buildTools, 'lib/d8.jar'), 'com.android.tools.r8.D8', '--lib', androidJar, '--min-api', '26', '--output', path.join(build, 'dex'), ...files(path.join(build, 'classes'), '.class')]);
// AAPT adds dex without rewriting AAPT2's existing resource/asset ZIP entries.
run(path.join(buildTools, 'aapt.exe'), ['add', path.join(build, 'unsigned.apk'), 'classes.dex'], path.join(build, 'dex'));
normalizeApkPaths(path.join(build, 'unsigned.apk'));
run(path.join(buildTools, 'zipalign.exe'), ['-f', '4', path.join(build, 'unsigned.apk'), path.join(build, 'aligned.apk')]);
if (!existsSync(signature)) run(path.join(javaHome, 'bin/keytool.exe'), ['-genkeypair', '-keystore', signature, '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey', '-dname', 'CN=Youyu Android Beta,OU=Internal Testing,O=Youyu,C=CN', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000']);
const apk = path.join(build, 'youyu-beta.apk');
run(path.join(javaHome, 'bin/java.exe'), ['-jar', path.join(buildTools, 'lib/apksigner.jar'), 'sign', '--ks', signature, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', apk, path.join(build, 'aligned.apk')]);
run(path.join(javaHome, 'bin/java.exe'), ['-jar', path.join(buildTools, 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', apk]);
run(path.join(buildTools, 'zipalign.exe'), ['-c', '4', apk]);
run(path.join(buildTools, 'aapt.exe'), ['dump', 'badging', apk]);
run(path.join(javaHome, 'bin/javac.exe'), ['-encoding', 'UTF-8', '-d', path.join(build, 'asset-test'), path.join(source, 'src/com/youyu/ledger/beta/BundledAssets.java'), path.join(project, 'tests/android/BundledAssetsSmokeTest.java')]);
run(path.join(javaHome, 'bin/java.exe'), ['-cp', path.join(build, 'asset-test'), 'com.youyu.ledger.beta.BundledAssetsSmokeTest', apk]);
const deliveredApk = path.join(output, '有余-安卓内测-0.1.2.apk');
copyFileSync(apk, deliveredApk);
const hash = createHash('sha256').update(readFileSync(apk)).digest('hex');
writeFileSync(path.join(output, 'SHA256.txt'), `${hash}  有余-安卓内测-0.1.2.apk\n`);
console.log(`APK ready: ${deliveredApk}`);
