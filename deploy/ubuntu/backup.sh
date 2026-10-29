#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
database=/var/lib/youyu/youyu.sqlite
[[ -f $database ]] || { echo 'No database exists yet.'; exit 0; }
install -d -m 700 /var/backups/youyu
backup="/var/backups/youyu/youyu-$(date -u +%Y%m%dT%H%M%SZ)-$$.sqlite"
umask 077
sqlite3 "$database" ".backup '$backup'"
result=$(sqlite3 "$backup" 'PRAGMA integrity_check;')
[[ $result == ok ]] || { echo 'Backup integrity check failed.' >&2; exit 1; }
gzip "$backup"
echo "Backup created: $backup.gz"
