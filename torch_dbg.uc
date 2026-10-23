const src = readfile('/usr/share/rpcd/ucode/portmanager') ?? '';
const body = src.replace("return { 'portmanager': methods };", 'let r = methods.torch.call({}); print(sprintf("%J", r));\nreturn { \"portmanager\": methods };');
print(body ? "ok" : "no");
