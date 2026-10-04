/**
 * CDP Fetch-domain request pauser — delays a specific image request so the
 * image stays in the browser "loading" state (proving the spinner UX).
 * Usage: bun scripts/cdp-delay-image.ts <urlPattern> <delayMs>
 * Keeps running until killed; every paused request is continued after delayMs.
 */
const CDP_HTTP = "http://127.0.0.1:42021";

async function getPageWsUrl(): Promise<string> {
  const res = await fetch(`${CDP_HTTP}/json/list`);
  const targets = (await res.json()) as { type: string; webSocketDebuggerUrl: string; url: string }[];
  const page = targets.find((t) => t.type === "page" && t.url.includes("space-z.ai"));
  if (!page) throw new Error("no matching page target");
  return page.webSocketDebuggerUrl;
}

async function main() {
  const pattern = process.argv[2] ?? "*seed-cab*";
  const delayMs = Number(process.argv[3] ?? 6000);

  const ws = new WebSocket(await getPageWsUrl());
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("ws connect failed"));
  });

  let id = 0;
  const send = (method: string, params: Record<string, unknown>) => {
    ws.send(JSON.stringify({ id: ++id, method, params }));
  };

  await new Promise<void>((res) => {
    const onMsg = (ev: MessageEvent) => {
      const data = JSON.parse(ev.data as string) as { id: number; result?: unknown };
      if (data.id === 1) {
        ws.removeEventListener("message", onMsg);
        res();
      }
    };
    ws.addEventListener("message", onMsg);
    send("Fetch.enable", { patterns: [{ urlPattern: pattern, requestStage: "Request" }] });
  });
  console.log(`PAUSER READY: pattern=${pattern} delay=${delayMs}ms`);

  ws.onmessage = (ev: MessageEvent) => {
    const data = JSON.parse(ev.data as string) as {
      method: string;
      params?: { requestId: string; request?: { url: string } };
    };
    if (data.method === "Fetch.requestPaused" && data.params) {
      const { requestId, request } = data.params;
      console.log(`PAUSED: ${request?.url}`);
      setTimeout(() => {
        send("Fetch.continueRequest", { requestId });
        console.log(`CONTINUED after ${delayMs}ms: ${request?.url}`);
      }, delayMs);
    }
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
