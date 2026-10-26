#!/bin/sh
d=youtube.com
echo "1: $(printf '%s' "$d" | grep -qE '^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.){1,}[A-Za-z]{2,}$' && echo match || echo nomatch)"
echo "2: $(printf '%s' "$d" | grep -qE '^([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$' && echo match || echo nomatch)"
echo "3: $(printf '%s' "$d" | grep -qE '^[A-Za-z0-9.-]+$' && echo match || echo nomatch)"
echo "4: $(printf '%s' "$d" | grep -q '.' && printf '%s' "$d" | grep -q '\.' && echo match || echo nomatch)"
echo "5 wide: $(printf 'www.googlevideo.com' | grep -qE '^([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$' && echo match || echo nomatch)"
