/**
 * Direct CDP control of the agent-browser Chrome instance.
 * Usage: bun scripts/cdp-throttle.ts <on|off>
 * on : clear cache + emulate 2 KB/s download (images crawl -> loading state visible)
 * off: disable network emulation
 */
const CDP_HTTP = "http://127.0.0.1:42021";

async function getPageWsUrl(): Promise<string> {
  const res = await fetch(`${CDP_HTTP}/json/list`);
  const targets = (await res.json()) as { type: string; webSocketDebuggerUrl: string; url: string }[];
  const page = targets.find((t) => t.type === "page" && t.url.includes("space-z.ai"));
  if (!page) throw new Error("no matching page target; targets: " + targets.map((t) => t.type + ":" + t.url).join(" | "));
  return page.webSocketDebuggerUrl;
}

async function main() {
  const mode = process.argv[2] === "on" ? "on" : "off";
  const wsUrl = await getPageWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("ws connect failed"));
  });

  let id = 0;
  const send = (method: string, params: Record<string, unknown>) =>
    new Promise<void>((res) => {
      const msgId = ++id;
      const onMsg = (ev: MessageEvent) => {
        const data = JSON.parse(ev.data as string) as { id: number };
        if (data.id === msgId) {
          ws.removeEventListener("message", onMsg);
          res();
        }
      };
      ws.addEventListener("message", onMsg);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send("Network.enable", {});
  await send("Network.clearBrowserCache", {});
  if (mode === "on") {
    // 2 KB/s download, 200ms latency — a 100MB image will effectively never finish
    await send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 200,
      downloadThroughput: 2 * 1024,
      uploadThroughput: 2 * 1024,
    });
    console.log("THROTTLE ON (2 KB/s), cache cleared");
  } else {
    await send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    console.log("THROTTLE OFF, cache cleared");
  }
  ws.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
