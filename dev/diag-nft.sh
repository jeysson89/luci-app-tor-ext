#!/bin/sh
echo "== packages that provide nft"
apk list --installed 2>/dev/null | grep -iE 'nft' | head -10
echo
echo "== the nft binary"
which nft
ls -la /usr/sbin/nft /usr/bin/nft 2>&1 | head -3
echo
echo "== what provides it"
apk info --who-owns /usr/sbin/nft 2>/dev/null || apk search -x nftables 2>/dev/null
