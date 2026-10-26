#!/bin/sh
echo "== uci state"
uci -q get tor_ext.split.lists; echo "rc=$?"
uci -q show tor_ext.split 2>/dev/null | head -6

echo
echo "== manual merge trace"
LISTS_DIR=/etc/tor-ext/lists
TAB=/usr/share/tor-ext/list-files.tab
. /usr/libexec/tor-ext/lib.sh

id=youtube
line=$(awk -F'\t' -v id="$id" '$1 == id { print $2 "@" $3 "@" $4; exit }' "$TAB")
echo "line=[$line]"
kind=${line%%@*}
echo "kind=[$kind]"
[ -f "$LISTS_DIR/$id.lst" ] && echo "file exists" || echo "file MISSING"

norm_domain() {
	local d
	d=$(printf '%s' "$1" | sed 's/[[:space:]]//g')
	case "$d" in
		''|"#"*|"//"*) return ;;
		*://*) d=${d#*://}; d=${d%%/*} ;;
	esac
	case "$d" in
		*[!A-Za-z0-9.-]*) return ;;
	esac
	while :; do
		case "$d" in
			'*.'*) d=${d#*.} ;;
			.*) d=${d#.} ;;
			*) break ;;
		esac
	done
	while [ "$d" != "${d%.}" ]; do d=${d%.}; done
	case "$d" in
		''|*[!*]*) return ;;
	esac
	printf '%s' "$d" | grep -q '\.' || return
	printf '%s' "$d" | grep -qE '^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z]$' || return
	printf '%s\n' "$d"
}

echo "norm1=[$(norm_domain youtube.com)]"
echo "norm2=[$(norm_domain www.googlevideo.com)]"
echo "norm3=[$(norm_domain .youtube.com)]"

echo
echo "== collect loop from the helper file"
sh -x /usr/libexec/tor-ext/lists merge 2>&1 | grep -E 'youtube|read|norm|LISTS_DIR|tmpd' | head -20
