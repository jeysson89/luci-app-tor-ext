#!/bin/sh
. /dev/null
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
		''|*'*'*) return ;;
	esac
	printf '%s' "$d" | grep -q '\.' || return
	printf '%s' "$d" | grep -qE '^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z]$' || return
	printf '%s\n' "$d"
}
echo "1=[$(norm_domain youtube.com)]"
echo "2=[$(norm_domain www.googlevideo.com)]"
echo "3=[$(norm_domain .youtube.com)]"
echo "4=[$(norm_domain *.foo.com)]"
echo "5=[$(norm_domain nosuffix)]"
echo "6=[$(norm_domain https://open.spotify.com/path)]"
echo "7=[$(norm_domain 'bad domain!')]"
