#!/usr/bin/env python3
"""Spawn a long-running command fully detached on Windows.

Usage: python launch_detached.py <exe> <logfile> <arg...>
The child survives the parent shell exiting; output goes to <logfile> (append);
child PID is written to <logfile>.pid and printed.
"""
import subprocess
import sys

def main():
    if len(sys.argv) < 3:
        print("usage: launch_detached.py <exe> <logfile> [args...]")
        return 2
    exe = sys.argv[1]
    log = sys.argv[2]
    args = sys.argv[3:]
    DETACHED_PROCESS = 0x00000008
    CREATE_NEW_PROCESS_GROUP = 0x00000200
    logf = open(log, "ab", buffering=0)
    pidf = open(log + ".pid", "w")
    p = subprocess.Popen(
        [exe] + args,
        stdout=logf,
        stderr=logf,
        stdin=subprocess.DEVNULL,
        creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
        close_fds=True,
    )
    pidf.write(str(p.pid))
    pidf.close()
    print("detached pid", p.pid, "log", log)
    return 0

if __name__ == "__main__":
    sys.exit(main())
