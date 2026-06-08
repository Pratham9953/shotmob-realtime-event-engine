let token = localStorage.getItem("token") || "";
let socket = null;

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const matchIdInput = document.getElementById("matchId");
const eventJsonInput = document.getElementById("eventJson");
const youtubeUrlInput = document.getElementById("youtubeUrl");
const logOutput = document.getElementById("log");

document.getElementById("registerBtn").addEventListener("click", () => {
  runAction(register);
});

document.getElementById("loginBtn").addEventListener("click", () => {
  runAction(login);
});

document.getElementById("connectSocketBtn").addEventListener("click", () => {
  runAction(connectSocket);
});

document.getElementById("sendEventBtn").addEventListener("click", () => {
  runAction(sendEvent);
});

document.getElementById("generateSummaryBtn").addEventListener("click", () => {
  runAction(generateSummary);
});

document.getElementById("ingestYoutubeBtn").addEventListener("click", () => {
  runAction(ingestYoutube);
});

function log(message, data) {
  const line = `[${new Date().toLocaleTimeString()}] ${message} ${
    data ? JSON.stringify(data, null, 2) : ""
  }\n`;

  logOutput.textContent += line;
  logOutput.scrollTop = logOutput.scrollHeight;
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    console.error(error);
    log("error", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.message || `Request failed with status ${response.status}`);
  }

  return json;
}

async function register() {
  const result = await api("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: emailInput.value,
      password: passwordInput.value
    })
  });

  token = result.data.accessToken;
  localStorage.setItem("token", token);

  log("registered", result.data.user);
}

async function login() {
  const result = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: emailInput.value,
      password: passwordInput.value
    })
  });

  token = result.data.accessToken;
  localStorage.setItem("token", token);

  log("logged in", result.data.user);
}

function connectSocket() {
  if (!token) {
    log("socket auth missing", {
      message: "Please register or login first"
    });
    return;
  }

  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io({
    auth: {
      token
    }
  });

  socket.on("connect", () => {
    log("socket connected", {
      socketId: socket.id
    });

    socket.emit("join-match", { matchId: matchIdInput.value }, (ack) => {
      log("joined room", ack);
    });
  });

  socket.on("raw-event", (payload) => {
    log("raw-event", payload);
  });

  socket.on("processed-event", (payload) => {
    log("processed-event", payload);
  });

  socket.on("video-status", (payload) => {
    log("video-status", payload);
  });

  socket.on("connect_error", (error) => {
    log("socket error", {
      message: error.message
    });
  });

  socket.on("disconnect", (reason) => {
    log("socket disconnected", {
      reason
    });
  });
}

async function sendEvent() {
  const payload = JSON.parse(eventJsonInput.value);

  const result = await api("/events", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  log("event accepted", result.data);
}

async function generateSummary() {
  const result = await api("/ai/summary", {
    method: "POST",
    body: JSON.stringify({
      matchId: matchIdInput.value
    })
  });

  log("ai summary", result.data);
}

async function ingestYoutube() {
  if (!youtubeUrlInput.value.trim()) {
    log("validation error", {
      message: "Please paste a YouTube URL"
    });
    return;
  }

  const result = await api("/youtube/ingest", {
    method: "POST",
    body: JSON.stringify({
      matchId: matchIdInput.value,
      youtubeUrl: youtubeUrlInput.value
    })
  });

  log("youtube ingestion queued", result.data);
}

log("demo loaded", {
  hasToken: Boolean(token)
});