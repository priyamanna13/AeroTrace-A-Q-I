#!/usr/bin/env python
"""Layout audit: verifies each .page fits its A4-landscape sheet and
that the document has no horizontal overflow. Run before final export."""
import json
import os
import subprocess
import time
import urllib.request

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9224

JS = """
(() => {
  const out = { pages: [], bodyOverflow: false, notes: [] };
  const px = 1123; // 297mm at 96dpi
  out.bodyOverflow = document.body.scrollWidth > px + 2;
  document.querySelectorAll('.page').forEach((p, i) => {
    const over = p.scrollHeight - p.clientHeight;
    out.pages.push({
      n: i + 1,
      id: p.id,
      clientH: p.clientHeight,
      scrollH: p.scrollHeight,
      overflowPx: over,
      status: over > 4 ? 'OVERFLOW' : 'ok'
    });
  });
  // svg sanity: any zero-size svgs?
  out.zeroSvgs = [...document.querySelectorAll('svg')].filter(s => s.clientWidth === 0).length;
  return JSON.stringify(out);
})()
"""


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    url = "file:///" + os.path.join(here, "index.html").replace("\\", "/").replace(" ", "%20")
    subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", f"--remote-debugging-port={PORT}",
         "--remote-allow-origins=*", "--no-first-run",
         "--user-data-dir=" + os.path.join(here, ".chrome-tmp")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(60):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version") as r:
                    ws_url = json.load(r)["webSocketDebuggerUrl"]
                break
            except Exception:
                time.sleep(0.5)
        import websocket
        ws = websocket.create_connection(ws_url, timeout=130)

        def cdp(method, **params):
            msg_id = cdp._n = getattr(cdp, "_n", 0) + 1
            ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
            deadline = time.time() + 120
            while time.time() < deadline:
                data = json.loads(ws.recv())
                if data.get("id") == msg_id:
                    return data.get("result", {})
            raise TimeoutError(method)

        target = cdp("Target.createTarget", url=url)
        session = cdp("Target.attachToTarget", targetId=target["targetId"], flatten=True)["sessionId"]
        time.sleep(1.5)

        def scdp(method, **params):
            msg_id = scdp._n = getattr(scdp, "_n", 0) + 1
            ws.send(json.dumps({"id": msg_id, "method": method, "params": params, "sessionId": session}))
            deadline = time.time() + 120
            while time.time() < deadline:
                data = json.loads(ws.recv())
                if data.get("id") == msg_id:
                    return data.get("result", {})
            raise TimeoutError(method)

        res = scdp("Runtime.evaluate", expression=JS, returnByValue=True)
        report = json.loads(res["result"]["value"])
        print(json.dumps(report, indent=1))
        bad = [p for p in report["pages"] if p["status"] != "ok"]
        print("\nVERDICT:", "FAIL" if (bad or report["bodyOverflow"] or report["zeroSvgs"]) else "ALL PAGES CLEAN")
    finally:
        subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True)


if __name__ == "__main__":
    main()
