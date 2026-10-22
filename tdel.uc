import { cursor } from "uci";

let u = cursor();
u.set("wireless", "default_radio1", "disabled", "0");
u.delete("wireless", "default_radio1", "disabled");
u.commit("wireless");
print(sprintf("%J", u.get_all("wireless", "default_radio1")));
