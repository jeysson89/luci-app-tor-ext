import sys, os, base64, paramiko

HOST = "192.168.1.1"
USER = "root"
PASS = "10203040"

def conn():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, look_for_keys=False,
              allow_agent=False, timeout=20)
    return c

def run(script, timeout=120):
    """Run a shell script on the router (via stdin, no quoting issues)."""
    c = conn()
    chan = c.get_transport().open_session()
    chan.settimeout(timeout)
    chan.exec_command("sh -s")
    chan.sendall(script.encode("utf-8"))
    chan.shutdown_write()
    out, err = b"", b""
    try:
        while True:
            if chan.recv_ready():
                out += chan.recv(65536)
            if chan.recv_stderr_ready():
                err += chan.recv_stderr(65536)
            if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
                break
    except Exception as e:
        err += ("\n[TIMEOUT/ERR %s]\n" % e).encode()
    rc = chan.recv_exit_status() if chan.exit_status_ready() else -1
    c.close()
    return rc, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")

def main():
    mode = sys.argv[1]
    if mode == "run":
        script = sys.stdin.read() if len(sys.argv) < 3 else open(sys.argv[2], encoding="utf-8").read()
        rc, out, err = run(script)
        sys.stdout.write(out)
        if err.strip():
            sys.stdout.write("\n--- STDERR ---\n" + err)
        sys.stdout.write("\n[exit=%d]\n" % rc)
    elif mode == "put":
        local, remote = sys.argv[2], sys.argv[3]
        with open(local, "rb") as f:
            data = f.read().decode("utf-8")
        marker = "__PM_EOF_%s__" % abs(hash(remote))
        script = "mkdir -p $(dirname '%s')\ncat > '%s' <<'%s'\n%s\n%s\nchmod 0755 '%s'\n" % (
            remote, remote, marker, data, marker, remote)
        rc, out, err = run(script)
        print("uploaded %s -> %s (rc=%d)" % (local, remote, rc))
        if err.strip():
            print(err)
    elif mode == "get":
        remote, local = sys.argv[2], sys.argv[3]
        c = conn(); sftp = c.open_sftp(); sftp.get(remote, local); sftp.close(); c.close()
        print("downloaded %s -> %s" % (remote, local))

if __name__ == "__main__":
    main()
