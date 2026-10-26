# -*- coding: utf-8 -*-
# Instrumented copy of the deployed tor-ext ucode backend for bisection
import io

p = "files/usr/share/rpcd/usr_share_rpcd_ucode_tor-ext_instr"
s = io.open("files/usr/share/rpcd/ucode/tor-ext", encoding="utf-8").read()

lines = s.split("\n")
out = []
for i, ln in enumerate(lines, 1):
    out.append(ln)
    if ln == "\t\t\t\tconst a = req.args ?? {};" and i == 1699:
        pass

# instrument the splitSave call body (line numbers 1698-1734):
lines2 = []
for i, ln in enumerate(lines, 1):
    if i == 1700:        # inside splitSave.call after body opening
        lines2.append("\t\t\t\tprint('m1 validation\\n');")
    if i == 1711:
        lines2.append("\t\t\t\tprint('m2 before splitSaveArgs\\n');")
    if i == 1712:
        lines2.append("\t\t\t\tprint('m3 splitSaveArgs done\\n');")
        lines2.append("\t\t\t\tprint('m4 sh calls start\\n');")
    if i == 1717:
        lines2.append("\t\t\t\tprint('m5 sh calls done\\n');")
    if i == 1722:
        lines2.append("\t\t\t\tprint('m6 before apply-proxy sh\\n');")
    if i == 1723:
        lines2.append("\t\t\t\tprint('m7 ok captured: ' + ok + '\\n');")
        lines2.append("\t\t\t\tprint('m8 match done rc=' + rc + '\\n');")
    if i == 1724:
        lines2.append("\t\t\t\tprint('m9 before splitState\\n');")
    if i == 1725:
        lines2.append("\t\t\t\tprint('m10 after splitState\\n');")
    lines2.append(ln)

s2 = "\n".join(lines2)
for tail in ("\treturn { 'tor-ext': exported };", "return { 'tor-ext': exported };"):
    if tail in s2:
        s2 = s2.replace(tail,
            "const args = { enabled: true, mode: 'proxy', scope: 'clients',\n"
            "\tclients: ['192.168.1.133'], lists: ['youtube'],\n"
            "\tcustom_domains: [], custom_subnets: [],\n"
            "\tblock_quic: true, block_dot: true, interval: '6h' };\n"
            "print('--- runner\\n');\n"
            "try { methods.splitSave.call({ args }); print('DONE\\n'); }\n"
            "catch (e) { print('CAUGHT ' + e + '\\n'); }\n"
            "return { 'tor-ext': exported };", 1)
        break
else:
    raise SystemExit("tail not found")

io.open("dev/mod-run.js", "w", encoding="utf-8", newline="\n").write(s2)
print("built dev/mod-run.js")
