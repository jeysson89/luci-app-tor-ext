#!/bin/sh
for d in ggpht.com ytimg.com gvt1.com www.gstatic.com googlevideo.com returnyoutubedislikeapi.com; do
  echo "-- $d"
  nslookup -timeout=10 "$d" 127.0.0.1:9053 2>&1 | grep -E 'Name:|Address[:0-9 ]' | head -4
done
