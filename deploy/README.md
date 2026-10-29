# 有余 · 阿里云 Ubuntu 24.04 部署

域名：youyuapp.com.cn；服务器公网 IP：8.133.167.22。
网站备案号：冀ICP备2025113362号-2。

本包是独立服务器版本。官网位于 `/`，网页版账本位于 `/app`，登录注册位于 `/login`。
网页版开放账号密码注册，按账号隔离账本，数据写入服务器 SQLite 文件。
Android 正式版 1.0.0 是本地离线账本，数据在手机加密保存，与网页版不自动同步。

## 1. 上传压缩包

电脑 Windows PowerShell 执行（在电脑上，不是在阿里云终端）：

```powershell
scp "D:\建院\账本\服务器部署\youyu-server-1.0.0.zip" admin@8.133.167.22:~/
```

使用创建服务器时配置的登录方式。首次连接核对阿里云实例的 SSH 指纹后确认。
如本机 SSH 登录尚未配置，使用阿里云远程连接的文件上传功能，或自己的 SFTP 客户端，把同一个压缩包传到 `/home/admin/`。
不需要把密码或私钥发送到聊天中。

## 2. 解压与安装

阿里云服务器终端逐条执行：

```bash
cd ~
mkdir -p youyu-upload
unzip -o youyu-server-1.0.0.zip -d youyu-upload
cd ~/youyu-upload
sudo bash ubuntu/install.sh
```

安装脚本会安装 Node.js 24（官方 HTTPS 下载并核对官方 SHA-256）、所需系统软件和依赖，运行账号与数据测试并构建网页。
构建完成并通过数据库健康检查后，才切换到新的程序目录并配置 Nginx。后续更新保留原 HTTPS 配置。
网站进程由 systemd 管理，以独立 `youyu` 用户运行，监听 `127.0.0.1:3000`；公网使用现有的 80、443 端口。
若命令报错，请保留输出并停止后续步骤，先处理该错误。

## 3. 开启 HTTPS

确保主域名与 www 都解析到 8.133.167.22，并且 80、443 已放行。

```bash
sudo certbot --nginx -d youyuapp.com.cn -d www.youyuapp.com.cn --redirect
```

按 Certbot 提示填写接收证书通知的邮箱、阅读并同意其条款。服务依靠 HTTPS 的安全 Cookie 保持登录，完成此步后再测试注册登录。

```bash
sudo certbot renew --dry-run
```

访问 `https://youyuapp.com.cn`，检查官网、ICP备案链接和 Android 下载；在 `/login` 注册自己的账号，创建账本，记一笔后刷新核对。
再用第二个账号确认无法读取第一个账号的账本。
下载的 APK 应名为 `youyu-1.0.0.apk`，网站提供 `downloads/SHA256.txt` 校验值。

## 运维与数据

```bash
sudo systemctl status youyu --no-pager
sudo journalctl -u youyu -n 80 --no-pager
curl -f http://127.0.0.1:3000/api/health
sudo systemctl status youyu-backup.timer --no-pager
sudo bash /opt/youyu/current/ubuntu/backup.sh
```

应用目录：`/opt/youyu/releases/`，当前版本由 `/opt/youyu/current` 链接指定。
运行设置：`/etc/youyu/youyu.env`（包含正式域名、注册开关、备案号）。
数据库：`/var/lib/youyu/youyu.sqlite`；账户、密码派生值、登录会话和网页版账本均在此。
夜间备份：`/var/backups/youyu/`，以服务器时间每天 03:20 后随机延迟至多 10 分钟执行。备份不会上传到公网，也不会自动清理旧备份，需根据磁盘使用情况管理。
服务器备份只保存在本机，请定期另行保存到自己的受控位置。
更新应用不能用空数据库覆盖此目录。迁移数据应使用 SQLite `.backup`，不要只复制运行中的主数据库文件而漏掉 WAL。

管理员为指定账号重置密码：

```bash
sudo -u youyu env YOUYU_DATA_DIR=/var/lib/youyu /usr/local/bin/node /opt/youyu/current/ubuntu/account.mjs 账号名
```

终端会隐藏密码输入，并要求再次确认；成功后撤销该账号此前的登录会话。
暂时关闭新用户注册，可把 `/etc/youyu/youyu.env` 中 `YOUYU_REGISTRATION=open` 改为 `closed`，再执行 `sudo systemctl restart youyu`。

## Android 正式版

版本 1.0.0，应用 ID `com.youyu.ledger`，独立正式签名，调试关闭。
与原 `com.youyu.ledger.beta` 内测版可同时安装。从旧版迁移请先导出 JSON 完整备份，再在正式版中恢复并核对。
不要先卸载仍存有账本的旧应用。APK 不申请联网权限，不需要网页版账号。
卸载应用会删除本机账本；JSON 导出文件未加密，请妥善保存。
正式签名私钥和密码只保留在开发电脑项目的 `mobile/android/signing/` 内，不包含在本服务器包中，后续升级需继续使用原签名。

## 验证范围

交付前完成本地账号/会话/数据隔离/并发版本冲突测试、Next.js 生产构建、HTTP 接口与下载检查，以及 APK 签名/清单/ZIP 对齐/最终包资源读取检查。
服务器端系统软件安装、Nginx 配置加载、systemd 服务和 HTTPS 证书需要在实际 Ubuntu 服务器执行后确认。
APK 的首次安装、导入导出、返回键和键盘布局仍需在实际手机上验收。

## npm ci 锁文件修复（2026-10-28）

首版部署包漏锁定部分 @emnapi WASM 间接依赖，npm 11.19.1 会报 EUSAGE。修复版使用单独保存、已补齐的 deploy/selfhost/package-lock.json；打包前须以相同 npm 运行严格安装预检，覆盖本机与 Linux x64/glibc 依赖选择。该预检不代替服务器实际安装。

已上传旧包时，在服务器执行 `cd /home/admin/youyu-upload`，再执行 `/usr/local/bin/npm install --package-lock-only --ignore-scripts --no-audit --no-fund`；成功后重新运行 `bash /home/admin/youyu-upload/ubuntu/install.sh`。补齐源目录锁文件后，安装器会把它复制到新的发布目录继续安装。
