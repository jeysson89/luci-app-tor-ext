#!/bin/sh
echo "== lyrebird size"
ls -la /tmp/lyre/usr/bin/lyrebird 2>&1
echo
echo "== free space by removing snowflake-client (lyrebird replaces it)"
apk del snowflake-client 2>&1 | tail -3
df -h /overlay | tail -1
echo
echo "== install lyrebird"
cp /tmp/lyre/usr/bin/lyrebird /usr/bin/lyrebird && chmod 0755 /usr/bin/lyrebird && echo copied
ls -la /usr/bin/lyrebird
df -h /overlay | tail -1
echo
echo "== run"
/usr/bin/lyrebird --help 2>&1 | head -12
echo "rc=$?"
