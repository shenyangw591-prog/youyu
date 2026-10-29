#!/usr/bin/env bash
set -euo pipefail
trap 'status=$?; printf "Installation stopped at line %s (exit %s). Review the output above.\n" "$LINENO" "$status" >&2; exit "$status"' ERR
[[ $EUID -eq 0 ]] || { echo 'Run: sudo bash ubuntu/install.sh' >&2; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
[[ -f "$source_dir/package-lock.json" && -f "$source_dir/runtime/store.mjs" ]] || { echo 'Extract the complete server package first.' >&2; exit 1; }
if [[ ! -x /usr/local/bin/node ]] || [[ $(/usr/local/bin/node -p 'process.versions.node.split(".")[0]') != 24 ]]; then
  bash "$source_dir/ubuntu/install-node.sh"
fi
apt-get update
apt-get install -y nginx ca-certificates curl rsync sqlite3 certbot python3-certbot-nginx
if ! id youyu >/dev/null 2>&1; then useradd --system --create-home --home-dir /var/lib/youyu --shell /usr/sbin/nologin youyu; fi
install -d -m 700 -o youyu -g youyu /var/lib/youyu
install -d -m 750 -o root -g youyu /etc/youyu
install -d -m 755 /opt/youyu/releases
if [[ ! -f /etc/youyu/youyu.env ]]; then install -m 640 -o root -g youyu "$source_dir/.env.production" /etc/youyu/youyu.env; fi
if [[ -e /opt/youyu/current && ! -L /opt/youyu/current ]]; then echo '/opt/youyu/current exists as a real directory. Preserve it and review the installation path.' >&2; exit 1; fi
release_dir="/opt/youyu/releases/$(date -u +%Y%m%dT%H%M%SZ)-$$"
install -d -m 755 -o youyu -g youyu "$release_dir"
rsync -a --exclude=node_modules --exclude=.next --exclude=data --exclude='.qa*' "$source_dir/" "$release_dir/"
chown -R youyu:youyu "$release_dir"
cd "$release_dir"
echo "Checking and installing locked dependencies..."
runuser -u youyu -- /usr/local/bin/npm ci --no-audit --no-fund
echo "Running account and ledger checks..."
runuser -u youyu -- env NEXT_TELEMETRY_DISABLED=1 /usr/local/bin/npm test
echo "Building the production website..."
runuser -u youyu -- env NEXT_TELEMETRY_DISABLED=1 /usr/local/bin/npm run build
mkdir -p "$release_dir/.next/cache"
chown youyu:youyu "$release_dir/.next/cache"
old_release=$(readlink /opt/youyu/current || true)
ln -s "$release_dir" /opt/youyu/.current.next
mv -Tf /opt/youyu/.current.next /opt/youyu/current
install -m 644 "$source_dir/ubuntu/youyu.service" /etc/systemd/system/youyu.service
systemctl daemon-reload
systemctl enable youyu
systemctl restart youyu
healthy=no
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/api/health >/dev/null; then healthy=yes; break; fi
  sleep 1
done
if [[ $healthy != yes ]]; then
  journalctl -u youyu -n 40 --no-pager
  if [[ -n $old_release && -d $old_release ]]; then
    ln -s "$old_release" /opt/youyu/.current.rollback
    mv -Tf /opt/youyu/.current.rollback /opt/youyu/current
    systemctl restart youyu
  else
    systemctl stop youyu
  fi
  echo 'Health check failed. Nginx configuration has not been changed.' >&2
  exit 1
fi
# Preserve Certbot's HTTPS configuration on subsequent application updates.
if [[ ! -f /etc/nginx/sites-available/youyu ]]; then
  install -m 644 "$source_dir/ubuntu/nginx.conf" /etc/nginx/sites-available/youyu
  ln -s /etc/nginx/sites-available/youyu /etc/nginx/sites-enabled/youyu
fi
nginx -t
systemctl reload nginx
install -m 644 "$source_dir/ubuntu/youyu-backup.service" /etc/systemd/system/youyu-backup.service
install -m 644 "$source_dir/ubuntu/youyu-backup.timer" /etc/systemd/system/youyu-backup.timer
systemctl daemon-reload
systemctl enable --now youyu-backup.timer
printf '\nApplication ready. Next, enable HTTPS:\n\nsudo certbot --nginx -d youyuapp.com.cn -d www.youyuapp.com.cn --redirect\n\n'
echo 'After HTTPS, visit https://youyuapp.com.cn and register your own account.'
