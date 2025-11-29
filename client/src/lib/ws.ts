// Lightweight shared WebSocket client with auto-reconnect and simple subscriptions

type ReferralUpdate = { type: 'referral_update'; userId: string; referredCount: number };
type FeedEventMsg = { type: 'feed_event'; event: any };
type Message = ReferralUpdate | FeedEventMsg | Record<string, unknown>;

type Listener = (msg: Message) => void;

let ws: WebSocket | null = null;
let urlIndex = 0;
let listeners: Set<Listener> = new Set();
let connecting = false;

const computeWsUrls = (): string[] => {
  const urls: string[] = [];
  try {
    // If API_BASE_URL exists, prefer that host
    const base = (window as any).API_BASE_URL as string | undefined;
    if (base) {
      const u = new URL(base);
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      urls.push(`${proto}//${u.host}`);
    }
  } catch {}
  const host = window.location.hostname || 'localhost';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  urls.push(`${proto}//${host}:3002`, `${proto}//${host}:3001`, `${proto}//${host}:5000`);
  return urls;
};

const urls = computeWsUrls();

function connect() {
  if (connecting || ws) return;
  connecting = true;
  const url = urls[urlIndex % urls.length];
  urlIndex++;
  try {
    ws = new WebSocket(url);
  } catch {
    connecting = false;
    setTimeout(connect, 2000);
    return;
  }

  ws.onopen = () => {
    connecting = false;
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data) as Message;
      listeners.forEach((l) => l(msg));
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    ws = null;
    connecting = false;
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    try { ws?.close(); } catch {}
  };
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (!ws && !connecting) connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      try { ws?.close(); } catch {}
      ws = null; connecting = false;
    }
  };
}

export function subscribeReferralUpdates(onUpdate: (msg: ReferralUpdate) => void): () => void {
  return subscribe((msg) => {
    if ((msg as any)?.type === 'referral_update') onUpdate(msg as ReferralUpdate);
  });
}


