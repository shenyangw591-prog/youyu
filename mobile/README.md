# 有余 Android 正式版

版本 1.0.0，应用 ID `com.youyu.ledger`，versionCode 10000。Android 8.0 及以上，系统 WebView 需支持 Chromium 111 对应的网页能力。

保留现有本地离线记账功能，不申请联网权限，也没有账号登录。账本由 AndroidKeyStore 的 AES-GCM 密钥加密后，原子写入手机私有目录。JSON 完整备份可导出和恢复；卸载应用会删除本机账本，请事先备份。导出的 JSON 文件未加密。

## 构建

从项目根目录执行：

```text
node scripts/release-android.mjs
```

使用现有 Node.js 依赖、JDK 17、Android platform 35 和 build-tools 35.0.0。工具默认在工作区 .tmp/android-beta-tools 中，也可通过 JAVA_HOME、YOUYU_ANDROID_PLATFORM、YOUYU_ANDROID_BUILD_TOOLS 指定。
构建参数来自 mobile/release.json。构建器在临时目录中把原 Java 源文件包名改为正式包名，并生成正式清单；历史内测构建文件仍保留。

正式包使用独立 RSA 3072 位 PKCS12 签名，关闭调试；首次构建自动生成签名，后续复用同一文件。私有签名及密码位于 mobile/android/signing/youyu-release.p12 和 release-credentials.json，均被 Git 忽略。请把两者作为长期签名资料妥善备份，不可上传到官网。

输出：工作区“安卓正式版/有余-1.0.0.apk”、SHA256.txt、release.json 和安装说明。同时把可公开下载的 APK 与校验值复制到 public/downloads/。

## 从内测版迁移

正式版与旧 com.youyu.ledger.beta 使用不同应用 ID 和签名，可以同时安装。请在旧内测版“我的”导出 JSON 完整备份，再到正式版“我的”恢复，核对记录后再处理旧应用。

本机账本与网页版账号账本不自动同步。后续正式更新必须保持正式应用 ID、签名和数据格式兼容，并提高 versionCode。

## 验证

构建器会核对正式包名、版本、正式签名、关闭调试、ZIP 对齐，并用应用相同的原生读取代码逐项读取最终 APK 的启动页、脚本、样式和图片。核心账本、备份与无效恢复保护由现有测试覆盖。

首次安装、飞行模式记账、关闭后重开、JSON 导入导出、系统返回键、键盘与覆盖升级仍需在实际 Android 手机上验收。现有提醒仅在打开应用时更新。
