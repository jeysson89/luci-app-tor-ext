#!/bin/sh
# ---------------------------------------------------------------------------
#  install.sh - установка и первичная настройка luci-app-tor-ext
#
#  Запуск с компьютера (Windows/PowerShell или Linux):
#
#      ssh root@192.168.1.1 'sh -s' < install.sh
#
#  или с роутера:
#
#      sh install.sh
#
#  Скрипт интерактивный: проверяет всё необходимое, спрашивает разрешение
#  на установку компонентов, создаёт базовую настройку и в конце помогает
#  добавить мосты и выбрать устройства, которые должны ходить через Tor.
#
#  Опции:
#      -y            всё подтверждать автоматически (без вопросов)
#      --no-proxy    не предлагать прозрачное проксирование
#      --app=URL     взять .apk по ссылке (по умолчанию - релиз с GitHub)
#      -h            справка
# ---------------------------------------------------------------------------

APP_NAME="luci-app-tor-ext"
APP_VERSION="1.0.0-r1"
GITHUB_REPO="jeysson89/luci-app-tor-ext"
DEFAULT_PKG_URL="https://github.com/$GITHUB_REPO/releases/download/v1.0.0/luci-app-tor-ext-1.0.0-r1.apk"

ASSUME_YES=0
ASK_PROXY=1
PKG_URL="$DEFAULT_PKG_URL"
SCRIPT_DIR="."

RED=""; GRN=""; YEL=""; BLU=""; BLD=""; RST=""
if [ -t 1 ]; then
	RED="$(printf '\033[1;31m')"; GRN="$(printf '\033[1;32m')"
	YEL="$(printf '\033[1;33m')"; BLU="$(printf '\033[1;34m')"
	BLD="$(printf '\033[1m')";    RST="$(printf '\033[0m')"
fi

say()  { printf '%s\n' "$*"; }
head1() { printf '\n%s=== %s ===%s\n' "$BLD$BLU" "$*" "$RST"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '%s  [ok]%s %s\n' "$GRN" "$RST" "$*"; }
warn() { printf '%s[вним.]%s %s\n' "$YEL" "$RST" "$*"; }
err()  { printf '%s[ошибка]%s %s\n' "$RED" "$RST" "$*"; }
step() { printf '\n%s-> %s%s\n' "$BLD" "$*" "$RST"; }

# yes/no вопрос. $1 - вопрос, $2 - ответ по умолчанию (y/n)
# ответы читаем с терминала: stdin может быть занят самим скриптом
TTY=/dev/stdin
if [ -c /dev/tty ] && (exec 3</dev/tty) 2>/dev/null; then
	TTY=/dev/tty
	exec 3<&-
fi

ask() {
	_q="$1"; _d="$2"
	if [ "$ASSUME_YES" = "1" ]; then
		info "$_q -> да (авто)"
		return 0
	fi
	while :; do
		printf '%s? %s %s[%s]%s ' "$BLD" "$_q" "$RST" "$_d" "$RST"
		read -r _a < "$TTY" || { _a="$_d"; warn "нет ввода, беру ответ по умолчанию"; return 0; }
		[ -z "$_a" ] && _a="$_d"
		case "$(echo "$_a" | tr '[:upper:]' '[:lower:]')" in
			y|yes|д|да) return 0 ;;
			n|no|н|нет) return 1 ;;
			*) warn "Ответьте y или n" ;;
		esac
	done
}

have() { command -v "$1" >/dev/null 2>&1; }

# разбор аргументов
while [ $# -gt 0 ]; do
	case "$1" in
		-y|--yes)     ASSUME_YES=1 ;;
		--no-proxy)  ASK_PROXY=0 ;;
		--app=*)     PKG_URL="${1#--app=}" ;;
		-h|--help)
			sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
			exit 0 ;;
		*) warn "неизвестный аргумент: $1 (справка: $0 -h)" ;;
	esac
	shift
done

pkg_installed() { apk list --installed 2>/dev/null | grep -q "^$1-[0-9]"; }

# ---------------------------------------------------------------------------
head1 "Проверка системы"

[ -f /etc/openwrt_release ] || { err "Это не OpenWrt. Скрипт нужно запускать на роутере."; exit 1; }
[ "$(id -u)" = "0" ] || { err "Нужен root."; exit 1; }

. /etc/openwrt_release 2>/dev/null
ok "система: ${DISTRIB_DESCRIPTION:-OpenWrt}"
ok "архитектура: $(uname -m), apk: $(apk --version 2>/dev/null | head -1)"

AVAIL_KB=$(df -k /overlay 2>/dev/null | awk 'NR==2 {print $4}')
[ -n "$AVAIL_KB" ] && info "свободно на overlay: $((AVAIL_KB / 1024)) МБ"

if have curl; then
	ok "curl: есть"
else
	warn "curl: нет (нужен для проверки IP и уведомлений)"
fi

# ---------------------------------------------------------------------------
head1 "Проверка компонентов"

MISSING=""
for p in tor curl conntrack rpcd-mod-ucode luci-base; do
	if pkg_installed "$p"; then
		ok "$p: установлен"
	else
		warn "$p: не установлен"
		MISSING="$MISSING $p"
	fi
done

# бинарник nft лежит в пакете nftables-json
if [ -x /usr/sbin/nft ] || [ -x /usr/bin/nft ]; then
	ok "nftables: есть ($(command -v nft))"
elif pkg_installed nftables-json; then
	ok "nftables-json: установлен"
else
	warn "nftables-json: не установлен (нужен для правил проксирования)"
	MISSING="$MISSING nftables-json"
fi

# транспорты: lyrebird (все) либо obfs4proxy/snowflake-client
TRANSPORT=""
if [ -x /usr/bin/lyrebird ]; then
	ok "lyrebird: /usr/bin/lyrebird (obfs4, snowflake, meek_lite, webtunnel)"
	TRANSPORT="lyrebird"
elif pkg_installed obfs4proxy; then
	ok "obfs4proxy: установлен (только obfs4)"
	TRANSPORT="obfs4proxy"
else
	MISSING="$MISSING obfs4proxy"
fi

if pkg_installed snowflake-client; then
	ok "snowflake-client: установлен"
fi

if [ -n "$MISSING" ]; then
	step "Установка недостающих компонентов"
	if ask "Установить недостающие пакеты:$(echo $MISSING)?" y; then
		for p in $MISSING; do
			info "apk add $p"
			apk add $p || warn "Не удалось поставить $p, продолжаю"
		done
	else
		warn "Пропускаю установку пакетов"
	fi
else
	ok "все обязательные компоненты на месте"
fi

# lyrebird - дополнительно (современные транспорты)
if [ "$TRANSPORT" != "lyrebird" ]; then
	step "Транспорты snowflake / webtunnel / meek_lite"
	info "В фидах OpenWrt нет их общего бинарника, но есть lyrebird из Alpine"
	info "(статическая сборка, работает на OpenWrt)."
	if ask "Установить lyrebird (нужно ~17 МБ)?" n; then
		LYR_VER="0.8.1-r7"
		LYR_URL="https://dl-cdn.alpinelinux.org/alpine/latest-stable/community/$(uname -m)/lyrebird-$LYR_VER.apk"
		if curl -sSL -m 900 -o /tmp/lyrebird.apk "$LYR_URL"; then
			rm -rf /tmp/lyrebird-x && mkdir -p /tmp/lyrebird-x
			if apk extract --allow-untrusted --destination /tmp/lyrebird-x /tmp/lyrebird.apk >/dev/null 2>&1; then
				cp /tmp/lyrebird-x/usr/bin/lyrebird /usr/bin/lyrebird
				chmod 0755 /usr/bin/lyrebird
				rm -rf /tmp/lyrebird-x /tmp/lyrebird.apk
				ok "lyrebird установлен: $(/usr/bin/lyrebird -version 2>/dev/null | head -1)"
				TRANSPORT="lyrebird"
			else
				warn "не удалось распаковать lyrebird"
			fi
		else
			warn "не удалось скачать lyrebird ($LYR_URL)"
		fi
	else
		info "оставляю только obfs4 (и snowflake-client, если он есть)"
	fi
fi

# ---------------------------------------------------------------------------
head1 "Установка интерфейса LuCI"

APP_INSTALLED=0
if pkg_installed "$APP_NAME"; then
	ok "$APP_NAME уже установлен"
	APP_INSTALLED=1
fi

if [ "$APP_INSTALLED" = "0" ]; then
	if ask "Установить веб-интерфейс ($APP_NAME)?" y; then
		APK=""
		for f in "$SCRIPT_DIR"/dist/$APP_NAME-*.apk /tmp/$APP_NAME/dist/$APP_NAME-*.apk; do
			[ -f "$f" ] && APK="$f" && break
		done

		if [ -z "$APK" ]; then
			info "пакета рядом со скриптом нет, пробую скачать:"
			info "$PKG_URL"
			if curl -sSL -m 900 -o "/tmp/$APP_NAME.apk" "$PKG_URL"; then
				APK="/tmp/$APP_NAME.apk"
			else
				warn "не удалось скачать пакет"
			fi
		fi

		if [ -n "$APK" ]; then
			if apk add --allow-untrusted "$APK"; then
				ok "установлено из $APK"
				APP_INSTALLED=1
			else
				warn "установка пакета не удалась"
			fi
		fi
	else
		info "пропускаю установку интерфейса (скрипт настроит только Tor)"
	fi
fi

# ---------------------------------------------------------------------------
head1 "Базовая настройка Tor"

mkdir -p /var/lib/tor /var/log/tor
chmod 0700 /var/lib/tor
id tor >/dev/null 2>&1 && chown -R tor:tor /var/lib/tor 2>/dev/null

TORRC=/etc/tor/torrc
if [ ! -f "$TORRC" ]; then
	mkdir -p /etc/tor
	cat > "$TORRC" <<'EOF'
DataDirectory /var/lib/tor
SocksPort 0.0.0.0:9050
TransPort 0.0.0.0:9040
DNSPort 0.0.0.0:9053
ControlPort 127.0.0.1:9051
CookieAuthentication 1
User tor
Log notice file /var/log/tor.log
EOF
	ok "создан базовый $TORRC"
else
	ok " torrc существует, правлю только недостающее"
	cp "$TORRC" "$TORRC.bak.$(date +%Y%m%d-%H%M%S)" 2>/dev/null
fi

add_directive() {
	# add_directive <директива> <значение> [комментарий]
	_key="$1"; _val="$2"; _comment="$3"
	if grep -qE "^[[:space:]]*$_key[[:space:]]" "$TORRC"; then
		info "$_key: уже есть"
	elif grep -qE "^[[:space:]]*#[[:space:]]*$_key[[:space:]]" "$TORRC"; then
		sed -i "s/^#[[:space:]]*$_key[[:space:]].*/$_key $_val/" "$TORRC"
		info "$_key: раскомментирован"
	else
		[ -n "$_comment" ] && printf '\n# %s\n' "$_comment" >> "$TORRC"
		printf '%s %s\n' "$_key" "$_val" >> "$TORRC"
		info "$_key: добавлен"
	fi
}

add_directive ControlPort "127.0.0.1:9051" "управление через веб-интерфейс (только localhost)"
add_directive CookieAuthentication "1" "обязательно для control-порта"
add_directive User "tor"
if ! grep -qE '^[[:space:]]*Log[[:space:]]' "$TORRC"; then
	add_directive Log "notice file /var/log/tor.log"
fi
if ! grep -qE '^[[:space:]]*SocksPort[[:space:]]' "$TORRC"; then
	add_directive SocksPort "0.0.0.0:9050"
fi
if ! grep -qE '^[[:space:]]*TransPort[[:space:]]' "$TORRC"; then
	add_directive TransPort "0.0.0.0:9040"
fi
if ! grep -qE '^[[:space:]]*DNSPort[[:space:]]' "$TORRC"; then
	add_directive DNSPort "0.0.0.0:9053"
fi

# каталог для резервных копий torrc
mkdir -p /etc/tor/backups
chmod 0700 /etc/tor/backups

# сторожевой таймер
if ! grep -q 'tor-ext/watchdog' /etc/crontabs/root 2>/dev/null; then
	mkdir -p /etc/crontabs
	echo '*/5 * * * * /usr/libexec/tor-ext/watchdog >/dev/null 2>&1' >> /etc/crontabs/root
	/etc/init.d/cron reload 2>/dev/null
	ok "добавлен сторожевой таймер (cron)"
fi

# сервисы
/etc/init.d/tor enable 2>/dev/null && ok "tor: автозапуск включён"
if [ -x /etc/init.d/tor-ext ]; then
	/etc/init.d/tor-ext enable 2>/dev/null && ok "tor-ext: автозапуск включён"
	/etc/init.d/tor-ext start 2>/dev/null
fi

/etc/init.d/tor restart 2>/dev/null
sleep 3

# ---------------------------------------------------------------------------
head1 "Мосты"

have_bridges() { grep -qE '^[[:space:]]*Bridge[[:space:]]' "$TORRC"; }

if have_bridges; then
	ok "в torrc уже есть мосты:"
	grep -E '^[[:space:]]*Bridge[[:space:]]' "$TORRC" | sed 's/^/      /'
	info "оставьте их как есть или замените своими (см. ниже)"
fi

if [ "$ASSUME_YES" = "1" ]; then
	BRIDGES_INPUT=0
elif ask "Добавить свои мосты в torrc (вставить строки сюда)?" n; then
	BRIDGES_INPUT=1
else
	BRIDGES_INPUT=0
fi

if [ "$BRIDGES_INPUT" = "1" ]; then
	info "Вставьте строки мостов, каждую с новой строки."
	info "Примеры:"
	info "  obfs4 1.2.3.4:443 CDA13CF5... cert=... iat-mode=0"
	info "  snowflake 1.2.3.4:443 FINGERPRINT url=https://... ice=stun:...:3478"
	info "  meek_lite 1.2.3.4:80 url=https://... front=example.com"
	info "  webtunnel [2001:db8::1]:443 FINGERPRINT url=https://..."
	info "После ввода - пустая строка."
	: > /tmp/bridges.in
	while IFS= read -r line < "$TTY"; do
		[ -z "$line" ] && break
		printf '%s\n' "$line" >> /tmp/bridges.in
	done

	if [ -s /tmp/bridges.in ]; then
		cp "$TORRC" "$TORRC.bak.$(date +%Y%m%d-%H%M%S)"
		sed -i '/^[[:space:]]*Bridge[[:space:]]/d' "$TORRC"
		cat /tmp/bridges.in >> "$TORRC"
		rm -f /tmp/bridges.in
		if ! grep -qE '^[[:space:]]*UseBridges[[:space:]]+1' "$TORRC"; then
			sed -i '1i UseBridges 1' "$TORRC"
		fi
		ok "добавлено мостов: $(grep -cE '^[[:space:]]*Bridge[[:space:]]' "$TORRC")"
		info "проверка конфигурации:"
		if tor --verify-config -f "$TORRC" 2>&1 | grep -qiE 'error|fail'; then
			warn "tor --verify-config ругается на конфигурацию, посмотрите /var/log/tor.log"
		else
			ok "конфигурация корректна"
		fi
	else
		info "мосты не добавлены"
	fi
fi

# ---------------------------------------------------------------------------
if [ "$ASK_PROXY" = "1" ]; then
	head1 "Прозрачное проксирование"

	info "Устройства из списка ниже будут ходить в интернет через Tor."
	info "Остальные - как обычно (напрямую)."
	echo
	if [ -f /tmp/dhcp.leases ]; then
		awk '{printf "      %-16s %s\n", $3, $4}' /tmp/dhcp.leases | head -30
	else
		info "список аренд DHCP пуст"
	fi
	echo

	CLIENTS=""
	if ask "Включить прозрачное проксирование для каких-то устройств?" y; then
		printf 'Введите IP через пробел (или +, чтобы выбрать из списка выше): '
		read -r line < "$TTY" || line=""
		for ip in $line; do
			case "$ip" in
				+*) continue ;;
				*[!0-9.]*|'') continue ;;
			esac
			CLIENTS="$CLIENTS $ip"
		done
		if [ -n "$CLIENTS" ]; then
			ok "устройства:$CLIENTS"
			info "их можно поменять позже в разделе «Проксирование»"
		else
			info "устройства не выбраны, проксирование останется выключенным"
		fi
	fi
fi

# ---------------------------------------------------------------------------
head1 "Применяем настройки"

if [ -x /usr/libexec/tor-ext/migrate ]; then
	/usr/libexec/tor-ext/migrate >/dev/null 2>&1 && ok "миграция выполнена"
fi

if [ -n "$CLIENTS" ]; then
	uci -q get tor_ext.proxy.client >/dev/null 2>&1
	for ip in $CLIENTS; do
		uci -q get tor_ext.proxy.client | tr ' ' '\n' | grep -qx "$ip" || \
			uci -q add_list tor_ext.proxy.client="$ip"
	done
	uci -q set tor_ext.proxy.enabled='1'
	uci -q commit tor_ext
	/usr/libexec/tor-ext/apply-proxy apply 2>/dev/null && ok "правила прозрачного проксирования применены"
fi

/etc/init.d/rpcd restart 2>/dev/null
rm -f /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null
/etc/init.d/tor restart 2>/dev/null
sleep 5

# ---------------------------------------------------------------------------
head1 "Готово"

i=0
BOOT=0
while [ $i -lt 24 ]; do
	BOOT=$(ubus call tor-ext status 2>/dev/null | jsonfilter -e '@.bootstrap.percent' 2>/dev/null)
	case "$BOOT" in
		100|101) break ;;
	esac
	i=$((i + 1))
	sleep 5
done
IP=$(ubus call tor-ext status 2>/dev/null | jsonfilter -e '@.ip.ip' 2>/dev/null)

LAN_IP=$(uci -q get network.lan.ipaddr 2>/dev/null | cut -d/ -f1)
[ -z "$LAN_IP" ] && LAN_IP=$(ip -4 addr show br-lan 2>/dev/null | sed -n 's/.*inet \([0-9.]*\).*/\1/p' | head -1)
[ -z "$LAN_IP" ] && LAN_IP=$(uname -n)
ISTOR=$(ubus call tor-ext status 2>/dev/null | jsonfilter -e '@.ip.tor' 2>/dev/null)

info "bootstrap: ${BOOT:-?}%"
[ -n "$IP" ] && info "внешний IP: $IP (Tor подтверждён: ${ISTOR:-?})"
[ -x /usr/bin/lyrebird ] && info "транспорты: lyrebird (obfs4, snowflake, meek_lite, webtunnel)"

cat <<EOF

${BLD}Что дальше:${RST}
  1) Веб-интерфейс:  http://$LAN_IP/cgi-bin/luci/admin/services/tor-ext/status
     Разделы: Статус, Мосты, Конфигурация, Порты и сервисы, Проксирование,
               Трафик, Логи, Мониторинг.
  2) Свои мосты:      раздел «Мосты» -> нужный тип -> «+ Добавить мост» ->
                      заполнить адрес/отпечаток -> «Проверить» -> «Сохранить».
  3) Устройства:      раздел «Проксирование» -> «Выбрать из аренд DHCP» ->
                      «Добавить» -> «Применить».
  4) Проверка:        ubus call tor-ext status
                      ubus call tor-ext trafficGet
EOF

if [ -n "$CLIENTS" ]; then
	say ""
	say "${BLD}Устройства через Tor:${RST}$CLIENTS"
	say "  DNS для них идёт через Tor (порт 9053), TCP - через 9040."
fi

say ""
say "${YEL}Подсказка:${RST} если Tor не подключается - посмотрите /var/log/tor.log"
say "и проверьте мосты: ubus call tor-ext bridgesTestStatus"
say ""
