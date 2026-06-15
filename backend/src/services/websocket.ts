import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

const clients = new Set<WebSocket>();

export function initWebSocketServer(server: Server) {
  // Mount the websocket server on the path /ws
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("[ws] client connected");
    clients.add(ws);

    ws.on("close", () => {
      console.log("[ws] client disconnected");
      clients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("[ws] client error:", err);
      clients.delete(ws);
    });
  });

  console.log("[ws] WebSocket server initialized on /ws");
}

export function broadcast(type: string, data: any) {
  const payload = JSON.stringify({ type, data });
  const openClients = Array.from(clients).filter(
    (c) => c.readyState === WebSocket.OPEN
  );
  
  if (openClients.length > 0) {
    console.log(`[ws] broadcasting ${type} to ${openClients.length} client(s)`);
  }

  for (const client of openClients) {
    try {
      client.send(payload);
    } catch (err) {
      console.error("[ws] failed to send message:", err);
    }
  }
}
