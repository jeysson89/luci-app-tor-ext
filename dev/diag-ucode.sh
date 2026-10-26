echo "== ucode builtin checks"
ucode -e 'try { print(lc("ABC")); } catch (e) { print("lc ERR: " + e); }'
echo
ucode -e 'try { print(match("rc=42", /rc=([0-9]+)/) + "\n"); } catch (e) { print("match ERR: " + e); }'
echo
ucode -e 'try { const rc = (match("no", /rc=([0-9]+)/) ?? [])[1]; print("idx: " + rc + "\n"); } catch (e) { print("idx ERR: " + e); }'
echo
echo "== shq present?"
grep -n 'function shq' /usr/share/rpcd/ucode/tor-ext | head -2
