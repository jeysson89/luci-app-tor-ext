#!/bin/sh
# Shared helpers for luci-app-tor-ext
TORRC="${TORRC:-/etc/tor/torrc}"
TOR_DATA="${TOR_DATA:-/var/lib/tor}"
TOR_COOKIE="${TOR_COOKIE:-/var/lib/tor/control_auth_cookie}"
TOR_LOG="${TOR_LOG:-/var/log/tor.log}"
TOR_EXT_STATE="${TOR_EXT_STATE:-/tmp/tor-ext}"

# Return the value of the last active directive in torrc
torrc_get() {
	local key="$1" def="$2" val="" line k
	[ -r "$TORRC" ] || { printf '%s\n' "$def"; return 0; }
	while IFS= read -r line; do
		line=$(printf '%s' "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
		case "$line" in
			''|\#*) continue ;;
		esac
		k=${line%%[[:space:]]*}
		[ "$k" = "$key" ] || continue
		val=${line#*[[:space:]]}
	done < "$TORRC"
	[ -n "$val" ] || val="$def"
	printf '%s\n' "$val"
}

# Strip bind address, return plain port number
torrc_port() {
	local key="$1" def="$2" v
	v=$(torrc_get "$key" "$def")
	v=${v%%[[:space:]]*}
	v=${v##*:}
	printf '%s\n' "$v"
}

tor_ext_uci() {
	local key="$1" def="$2" v
	v=$(uci -q get "tor_ext.$key")
	[ -n "$v" ] || v="$def"
	printf '%s\n' "$v"
}

tor_ext_ensure_dirs() {
	mkdir -p "$TOR_DATA" "$TOR_EXT_STATE" /var/log
	chmod 700 "$TOR_DATA"
	# tor drops privileges to the "tor" user
	touch "$TOR_LOG" 2>/dev/null
	if id tor >/dev/null 2>&1; then
		chown -R tor:tor "$TOR_DATA" 2>/dev/null
		chown tor:tor "$TOR_LOG" 2>/dev/null
	fi
}

# Make sure the management options required by the UI are present
tor_ext_ensure_baseline() {
	local changed=0 line port
	[ -r "$TORRC" ] || return 0

	# the control port must only listen on the loopback interface, it is
	# protected by the cookie authentication but must not be reachable
	# from the network
	line=$(torrc_get ControlPort '')
	if [ -z "$line" ]; then
		printf '\n# luci-app-tor-ext: management control port\nControlPort 127.0.0.1:9051\n' >> "$TORRC"
		changed=1
	elif ! echo "$line" | grep -qE '^(127\.|localhost)'; then
		port=${line##*:}
		case "$port" in
			''|*[!0-9]*) port=9051 ;;
		esac
		sed -i "s|^ControlPort .*|ControlPort 127.0.0.1:$port|" "$TORRC"
		changed=1
	fi

	# cookie authentication is mandatory for the control port
	if ! grep -qE '^[[:space:]]*CookieAuthentication[[:space:]]' "$TORRC"; then
		printf 'CookieAuthentication 1\n' >> "$TORRC"
		changed=1
	elif ! grep -qE '^[[:space:]]*CookieAuthentication[[:space:]]+1' "$TORRC"; then
		sed -i 's|^CookieAuthentication .*|CookieAuthentication 1|' "$TORRC"
		changed=1
	fi

	# tor should not run as root
	if ! grep -qE '^[[:space:]]*User[[:space:]]' "$TORRC"; then
		printf 'User tor\n' >> "$TORRC"
		changed=1
	fi
	tor_ext_ensure_dirs
	[ "$changed" = 1 ] && logger -t tor-ext "torrc: added management options (ControlPort/CookieAuthentication/User tor)"
	return 0
}

# true when the tor service is running
tor_ext_running() {
	local pid
	pid=$(ubus call service list '{"name":"tor","verbose":true}' 2>/dev/null | jsonfilter -e '@.tor.instances.*.pid' 2>/dev/null | head -n1)
	[ -n "$pid" ] && [ -d "/proc/$pid" ]
}
