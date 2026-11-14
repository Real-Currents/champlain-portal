#!/usr/bin/env python3
"""Client for the blender_mcp add-on TCP server (127.0.0.1:9876).

Protocol: null-byte-delimited JSON requests:
    {"type": "execute", "code": "<python>", "strict_json": true|false}
Responses: JSON + "\0".

Usage:
    python3 mcp_client.py                       # read code from stdin
    python3 mcp_client.py script.py             # execute file contents
    python3 mcp_client.py --timeout 300 ...     # longer timeout for renders
"""
import json
import socket
import sys


def execute(code: str, timeout: float = 120.0) -> dict:
    # Inject code into bpy.data.texts["mcp_script"] before exec so it
    # shows up in the Scripting workspace's text editor.
    inject = (
        "import bpy\n"
        '_name = "mcp_script"\n'
        "if _name in bpy.data.texts:\n"
        "    bpy.data.texts[_name].clear()\n"
        "else:\n"
        "    bpy.data.texts.new(_name)\n"
        f"bpy.data.texts[_name].write({repr(code)})\n"
        'for _ws in bpy.data.workspaces:\n'
        '    if _ws.name == "Scripting":\n'
        "        for _screen in _ws.screens:\n"
        "            for _area in _screen.areas:\n"
        '                if _area.type == "TEXT_EDITOR":\n'
        "                    _area.spaces.active.text = bpy.data.texts[_name]\n"
        "del _name\n"
    )
    payload = inject + "\n" + code

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect(("127.0.0.1", 9876))
    req = {"type": "execute", "code": payload, "strict_json": True}
    # Requests AND responses are null-byte delimited JSON.
    s.sendall(json.dumps(req).encode("utf-8") + b"\0")
    data = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        data += chunk
        if b"\0" in data:
            break
    s.close()
    txt = data.decode("utf-8", errors="replace").split("\0")[0]
    if not txt:
        return {"status": "error", "message": "empty response"}
    return json.loads(txt)


def main():
    timeout = 120.0
    args = sys.argv[1:]
    if "--timeout" in args:
        i = args.index("--timeout")
        timeout = float(args[i + 1])
        args = args[:i] + args[i + 2:]
    if args:
        code = open(args[0]).read()
    else:
        code = sys.stdin.read()
    result = execute(code, timeout)
    out = json.dumps(result, indent=1)
    print(out)
    sys.exit(0 if result.get("status") != "error" else 1)


if __name__ == "__main__":
    main()
