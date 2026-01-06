const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

let clients = new Set();
let messages = []; // CHAT HISTORY
let rain = null;   // CURRENT RAIN

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}

wss.on("connection", (ws) => {
  clients.add(ws);

  // SEND INITIAL DATA TO NEW USER
  ws.send(JSON.stringify({
    type: "init",
    messages,
    rain,
    online: clients.size
  }));

  if (rain) {
    ws.send(JSON.stringify({
      type: "rain_start",
      rain
    }));
  }

  // UPDATE ONLINE COUNT
  broadcast({ type: "online", online: clients.size });

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    /* ===== CHAT ===== */
    if (data.type === "chat") {
      const msg = {
        type: "chat",
        name: data.name,
        text: data.text,
        time: Date.now()
      };

      messages.push(msg);
      if (messages.length > 100) messages.shift(); // limit history

      broadcast(msg);
    }

    /* ===== RAIN JOIN ===== */
    if (data.type === "join_rain" && rain) {
      if (!rain.joined.includes(data.name)) {
        rain.joined.push(data.name);

        broadcast({
          type: "rain_update",
          joined: rain.joined.length
        });
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    broadcast({ type: "online", online: clients.size });
  });
});

function startRain() {
  if (rain) return; // prevent overlap

  rain = {
    amount: "250.00",
    joined: []
  };

  console.log("RAIN STARTED");

  broadcast({
    type: "rain_start",
    rain
  });

  setTimeout(() => {
    broadcast({
      type: "rain_end",
      reward: rain.joined.length
        ? (rain.amount / rain.joined.length).toFixed(2)
        : 0
    });

    rain = null;
  }, 5000);
}

// TEST EVERY 60 SECOND
setInterval(startRain, 1800000);


console.log("WebSocket server running on ws://localhost:8080");
