#!/bin/sh
# ---------------------------------------------------------------------------
# Установка транспортов (obfs4 / snowflake / meek_lite / webtunnel) на роутер.
#
# В фидах OpenWrt есть только obfs4proxy (только obfs4). Современный Tor
# Browser использует lyrebird - один бинарник на все транспорты. Готовой
# сборки в фидах нет, но она есть в community-репозитории Alpine (статическая
# сборка, работает на OpenWrt).
#
#     sh install-lyrebird.sh
# ---------------------------------------------------------------------------

set -e

ALPINE_VER="0.8.1-r7"
BASE="https://dl-cdn.alpinelinux.org/alpine/latest-stable/community/aarch64"

case "$(uname -m)" in
	aarch64) ARCH=aarch64 ;;
	armv7*)  ARCH=armv7 ;;
	x86_64)  ARCH=x86_64 ;;
	*) echo "Неизвестная архитектура: $(uname -m)"; exit 1 ;;
esac

if [ -x /usr/bin/lyrebird ]; then
	echo "lyrebird уже установлен: $(/usr/bin/lyrebird -version 2>/dev/null | head -1)"
	exit 0
fi

echo "[lyrebird] скачиваем lyrebird-$ALPINE_VER ($ARCH)"
cd /tmp
curl -sSL -m 900 -o lyrebird.apk "$BASE/lyrebird-$ALPINE_VER.apk" || {
	echo "Не удалось скачать пакет (нет прямого доступа в интернет?)"
	echo "Скачайте вручную: $BASE/lyrebird-$ALPINE_VER.apk"
	exit 1
}

echo "[lyrebird] распаковываем"
rm -rf /tmp/lyrebird-extract
mkdir -p /tmp/lyrebird-extract
apk extract --allow-untrusted --destination /tmp/lyrebird-extract lyrebird.apk
cp /tmp/lyrebird-extract/usr/bin/lyrebird /usr/bin/lyrebird
chmod 0755 /usr/bin/lyrebird
rm -rf /tmp/lyrebird-extract /tmp/lyrebird.apk

echo "[lyrebird] готово: $(/usr/bin/lyrebird -version 2>/dev/null | head -1)"
echo
echo "Теперь в разделе «Мосты» приложение само выберет lyrebird и запишет"
echo "в torrc строку для всех транспортов. Проверить: ubus call tor-ext bridgesGet"
