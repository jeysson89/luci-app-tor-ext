#!/bin/sh
echo "== enabled_ids"
. /usr/libexec/tor-ext/lib.sh
uci -q get tor_ext.split.lists | tr ' \t' '\n\n' | grep -v '^$' | sed 's/^/  id: ./'

echo
echo "== manual merge trace"
tmpd=/tmp/.merge.d
: > "$tmpd"
id=youtube
LISTS_DIR=/etc/tor-ext/lists
while IFS= read -r l; do echo "line: [$l]"; done < "$LISTS_DIR/youtube.lst"
echo
echo "== norm_domain test"
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
	while [ "$d" != "${d#*.}" ]; do d=${d#*.}; done
	case "$d" in
		'*'*) return ;;
	esac
	while [ "$d" != "${d%.}" ]; do d=${d%.}; done
	printf '%s' "$d" | grep -qE '^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.){1,}[A-Za-z]{2,}$' || return
	printf '%s\n' "$d"
}
echo "res: $(norm_domain youtube.com)"
echo "res: $(norm_domain www.googlevideo.com)"
echo "res bad:$(norm_domain #comment)"
echo
echo "== run merge"
/usr/libexec/tor-ext/lists merge
echo "domains count: $(cat /tmp/tor-ext/split-domains.count)"
cat /tmp/tor-ext/split-domains.lst
