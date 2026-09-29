#!/usr/bin/env python
"""Render AeroTrace_Proposal/index.html to a 10-page A4-landscape PDF
via Chrome DevTools Protocol (Page.printToPDF), which honors explicit
paper dimensions regardless of @page CSS support.

Usage:  python render.py [output.pdf]
"""
import base64
import json
import subprocess
import sys
import time
import urllib.request

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9223


def cdp(ws, method, **params):
    msg_id = cdp._n = getattr(cdp, "_n", 0) + 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    deadline = time.time() + 120
    while time.time() < deadline:
        raw = ws.recv()
        if not raw:
            continue
        data = json.loads(raw)
        if data.get("id") == msg_id:
            if "error" in data:
                raise RuntimeError(f"{method}: {data['error']}")
            return data.get("result", {})
    raise TimeoutError(method)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "AeroTrace_AQI_Proposal_PMJIT_NGEC.pdf"
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    url = "file:///" + os.path.join(here, "index.html").replace("\\", "/")
    import re as _re
    url = _re.sub(r"(?P<p>[ /])", lambda m: {" ": "%20", "/": "/"}[m.group("p")] if m.group("p") == " " else m.group("p"), url)

    subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", f"--remote-debugging-port={PORT}",
         "--remote-allow-origins=*",
         "--no-first-run", "--no-default-browser-check", "--user-data-dir=" + os.path.join(here, ".chrome-tmp")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        ws_url = None
        for _ in range(60):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version") as r:
                    ws_url = json.load(r)["webSocketDebuggerUrl"]
                break
            except Exception:
                time.sleep(0.5)
        if not ws_url:
            raise RuntimeError("Chrome debug endpoint never came up")

        import websocket
        ws = websocket.create_connection(ws_url, timeout=130)

        cdp(ws, "Target.createTarget", url="about:blank")
        target = cdp(ws, "Target.createTarget", url=url)
        tid = target["targetId"]
        session = cdp(ws, "Target.attachToTarget", targetId=tid, flatten=True)["sessionId"]
        time.sleep(1.5)  # allow fonts/layout

        # Wrap send/recv with sessionId routing
        def scdp(method, **params):
            msg_id = scdp._n = getattr(scdp, "_n", 0) + 1
            ws.send(json.dumps({"id": msg_id, "method": method, "params": params, "sessionId": session}))
            deadline = time.time() + 120
            while time.time() < deadline:
                raw = ws.recv()
                if not raw:
                    continue
                data = json.loads(raw)
                if data.get("id") == msg_id:
                    if "error" in data:
                        raise RuntimeError(f"{method}: {data['error']}")
                    return data.get("result", {})
            raise TimeoutError(method)

        ready = scdp("Runtime.evaluate", expression="document.readyState")
        print("document.readyState:", ready.get("result", {}).get("value"))

        result = scdp(
            "Page.printToPDF",
            landscape=False,  # dimensions below are already landscape; enabling swaps them
            displayHeaderFooter=False,
            printBackground=True,
            paperWidth=11.69,
            paperHeight=8.27,
            marginTop=0, marginBottom=0, marginLeft=0, marginRight=0,
            pageRanges="1-10",
            scale=1.0,
        )
        pdf_b64 = result["data"]
        with open(out, "wb") as f:
            f.write(base64.b64decode(pdf_b64))
        print(f"written: {out} ({os.path.getsize(out)} bytes)")

        cdp(ws, "Target.closeTarget", targetId=tid)
    finally:
        subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True)


if __name__ == "__main__":
    main()
