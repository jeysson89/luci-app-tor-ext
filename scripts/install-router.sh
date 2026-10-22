#!/bin/sh
# ---------------------------------------------------------------------------
# Установка luci-app-tor-ext и всех зависимостей на роутер OpenWrt 25.12
#
# Запуск на самом роутере:
#     sh install-router.sh /путь/к/luci-app-tor-ext
#
# Что делает:
#   1) ставит зависимости (tor, curl, nftables, conntrack);
#   2) устанавливает приложение (готовый .apk или файлы из files/);
#   3) выполняет миграцию со старой ручной настройки Tor;
#   4) включает сервисы tor и tor-ext (правила прозрачного проксирования).
# ---------------------------------------------------------------------------

set -e

SRC="${1:-/tmp/luci-app-tor-ext}"
LOG="tor-ext-install"

log() {
	echo "[install] $*"
	logger -t "$LOG" "$*"
}

[ -f /etc/openwrt_release ] || {
	echo "Это не OpenWrt, скрипт нужно запускать на роутере."
	exit 1
}

command -v apk >/dev/null 2>&1 || {
	echo "Нет apk (это не OpenWrt 25.12+)."
	exit 1
}

log "=== зависимости ==="
apk update >/dev/null 2>&1 || true
apk add tor curl nftables conntrack 2>&1 | tail -3
# транспорты (obfs4/snowflake/meek/webtunnel) ставятся отдельным скриптом:
#   sh install-lyrebird.sh

log "=== приложение ==="
APK=""
for f in "$SRC"/dist/luci-app-tor-ext-*.apk; do
	[ -f "$f" ] && APK="$f" && break
done

if [ -n "$APK" ]; then
	log "установка $APK"
	apk add --allow-untrusted "$APK" 2>&1 | tail -3
elif [ -d "$SRC/files" ]; then
	log "пакета нет, раскладываю файлы из $SRC/files"
	tar -czf /tmp/tor-ext-files.tar.gz -C "$SRC/files" .
	tar -xzf /tmp/tor-ext-files.tar.gz -C /
	rm -f /tmp/tor-ext-files.tar.gz
	chmod 0755 /etc/init.d/tor-ext /usr/libexec/tor-ext/* /usr/share/rpcd/ucode/tor-ext
else
	echo "Не найден ни $SRC/dist/*.apk, ни $SRC/files"
	exit 1
fi

log "=== миграция ==="
[ -x /usr/libexec/tor-ext/migrate ] && /usr/libexec/tor-ext/migrate

log "=== сервисы ==="
/etc/init.d/tor-ext enable 2>/dev/null || true
/etc/init.d/tor enable 2>/dev/null || true
/etc/init.d/tor-ext start 2>/dev/null || true
/etc/init.d/rpcd restart 2>/dev/null || true
rm -f /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true

log "=== готово ==="
echo
echo "Приложение: Сервисы -> Tor"
echo "Проверка состояния:"
echo "    ubus call tor-ext status"
echo
echo "Если правила прозрачного проксирования не применились, откройте"
echo "раздел «Проксирование», добавьте устройство и нажмите «Применить»."
