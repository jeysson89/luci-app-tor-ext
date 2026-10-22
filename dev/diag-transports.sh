#!/bin/sh
echo "== transports"
ubus call tor-ext bridgesGet | jsonfilter -e '@.transports[*].key'
ubus call tor-ext bridgesGet | jsonfilter -e '@.transports[*].installed'
