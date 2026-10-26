#!/bin/sh
echo "== uci.set with array / null"
ucode -e '
import { cursor } from "uci";
const u = cursor();
try { u.set("tor_ext", "split", "lists", ["youtube"]); print("array ok\n"); } catch (e) { print("array ERR: " + e + "\n"); }
try { u.set("tor_ext", "split", "client", null); print("null ok\n"); } catch (e) { print("null ERR: " + e + "\n"); }
try { u.delete("tor_ext", "split", "client"); print("delete ok\n"); } catch (e) { print("delete ERR: " + e + "\n"); }
u.commit("tor_ext");
'
uci -q get tor_ext.split.lists
echo "== run"
