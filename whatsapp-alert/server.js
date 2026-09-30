// Serviço de aviso de pedidos por WhatsApp.
//
// Conecta um WhatsApp por QR code (como o WhatsApp Web) e expõe:
//   GET  /?token=...       página com o QR code / status da conexão
//   GET  /health           status em JSON (com Authorization: Bearer <token>)
//   POST /send             { to, text } → envia a mensagem (Authorization: Bearer <token>)
//   POST /logout?token=... desconecta o WhatsApp
//
// Variáveis: ALERT_TOKEN (obrigatória), PORT, AUTH_DIR (pasta da sessão —
// num volume persistente, senão precisa ler o QR de novo a cada deploy).
// No Railway, sem AUTH_DIR a sessão vai sozinha pro volume do serviço.

import http from "node:http";
import path from "node:path";
import { rename, rm } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.ALERT_TOKEN || "";
const VOLUME_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || "";
const AUTH_DIR = process.env.AUTH_DIR || (VOLUME_DIR ? path.join(VOLUME_DIR, "auth") : "./auth");
const MIN_INTERVAL_MS = 4000; // espaço mínimo entre mensagens (evita cara de robô)
// Quantos "desconectado" (401) seguidos até desistir da sessão e pedir QR novo.
// O WhatsApp às vezes manda 401 numa queda passageira; só apagar na 1ª faz
// perder uma sessão boa.
const LOGGED_OUT_RETRIES = 3;

// Sessão fora do volume = some a cada reinício do Railway e pede QR de novo.
const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT);
const persistent = VOLUME_DIR
  ? path.resolve(AUTH_DIR).startsWith(path.resolve(VOLUME_DIR) + path.sep)
  : onRailway
    ? false
    : null; // fora do Railway: não dá pra saber
if (persistent === false) {
  console.warn(
    `ATENÇÃO: a sessão do WhatsApp está em ${path.resolve(AUTH_DIR)}, fora de um volume. ` +
      "Todo reinício vai pedir o QR code de novo. Crie um volume no serviço (ex.: /data) e use AUTH_DIR=/data/auth."
  );
}

if (TOKEN.length < 16) {
  console.error("Defina ALERT_TOKEN com pelo menos 16 caracteres (é a senha do serviço).");
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL || "warn" });

let sock = null;
let qr = null;
let status = "iniciando"; // iniciando | aguardando_qr | conectado | reconectando
let me = null;
let reconnectTimer = null;
let lastDisconnect = null; // { code, reason, at } — aparece no painel da loja
let loggedOutStreak = 0;
let failures = 0;
let shuttingDown = false;
// Gravações da sessão uma de cada vez (duas ao mesmo tempo podem corromper
// o creds.json e aí o WhatsApp pede QR de novo).
let pendingSave = Promise.resolve();

function describeDisconnect(code, error) {
  switch (code) {
    case DisconnectReason.loggedOut:
      return "O WhatsApp encerrou a sessão (desconectado em Aparelhos conectados ou pelo próprio WhatsApp).";
    case DisconnectReason.connectionReplaced:
      return "Outra conexão abriu a mesma sessão (o serviço está rodando duas vezes?).";
    case DisconnectReason.restartRequired:
      return "Reinício pedido pelo WhatsApp (normal logo depois de ler o QR).";
    case DisconnectReason.badSession:
      return "Arquivo da sessão com problema.";
    case DisconnectReason.forbidden:
      return "O WhatsApp bloqueou este número para aparelhos conectados.";
    case DisconnectReason.multideviceMismatch:
      return "Versão de aparelhos conectados incompatível.";
    case DisconnectReason.connectionClosed:
    case DisconnectReason.connectionLost:
    case DisconnectReason.timedOut:
    case DisconnectReason.unavailableService:
      return "Queda de conexão com o WhatsApp (internet/servidor). Reconecta sozinho.";
    default:
      return error?.message || "Conexão fechada.";
  }
}

function scheduleReconnect(ms) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connect().catch((err) => {
      console.error("Falha ao reconectar:", err);
      failures += 1;
      scheduleReconnect(Math.min(60_000, 2000 * 2 ** Math.min(failures, 5)));
    });
  }, ms);
}

/** Tira a sessão velha do caminho (guarda uma cópia) pra gerar QR novo. */
async function discardSession() {
  const backup = `${AUTH_DIR}-anterior`;
  await rm(backup, { recursive: true, force: true }).catch(() => {});
  await rename(AUTH_DIR, backup).catch(() => rm(AUTH_DIR, { recursive: true, force: true }));
}

async function connect() {
  clearTimeout(reconnectTimer);
  await pendingSave;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const current = makeWASocket({
    auth: state,
    version,
    logger,
    browser: Browsers.ubuntu("Avisos da loja"),
    markOnlineOnConnect: false, // não aparece "online" no celular dele
    syncFullHistory: false,
  });
  sock = current;

  current.ev.on("creds.update", () => {
    pendingSave = pendingSave.then(saveCreds).catch((err) => console.error("Erro ao salvar a sessão:", err));
  });
  current.ev.on("connection.update", async (update) => {
    if (current !== sock) return; // evento de uma conexão antiga
    if (update.qr) {
      qr = update.qr;
      status = "aguardando_qr";
    }
    if (update.connection === "open") {
      qr = null;
      status = "conectado";
      loggedOutStreak = 0;
      failures = 0;
      me = (current.user?.id || "").split(":")[0].split("@")[0] || null;
      console.log(`Conectado como +${me}`);
    }
    if (update.connection === "close") {
      const error = update.lastDisconnect?.error;
      const code = error?.output?.statusCode;
      const reason = describeDisconnect(code, error);
      lastDisconnect = { code: code ?? null, reason, at: new Date().toISOString() };
      console.log(`Conexão fechada (código ${code ?? "?"}): ${reason}`);
      if (shuttingDown) return;

      if (code === DisconnectReason.loggedOut) {
        loggedOutStreak += 1;
        if (loggedOutStreak < LOGGED_OUT_RETRIES) {
          // Pode ser passageiro: tenta de novo com a mesma sessão antes de desistir.
          status = "reconectando";
          scheduleReconnect(10_000 * loggedOutStreak);
          return;
        }
        console.log("Sessão encerrada de vez. Gerando QR novo...");
        await pendingSave;
        await discardSession();
        loggedOutStreak = 0;
        me = null;
        status = "iniciando";
        scheduleReconnect(3000);
        return;
      }

      status = "reconectando";
      if (code === DisconnectReason.restartRequired) return scheduleReconnect(1000);
      // Outra instância usando a sessão: espera em vez de ficar "brigando" por ela.
      if (code === DisconnectReason.connectionReplaced) return scheduleReconnect(60_000);
      failures += 1;
      scheduleReconnect(Math.min(60_000, 2000 * 2 ** Math.min(failures, 5)));
    }
  });
}

// ---------------------------------------------------------------- envio

let lastSentAt = 0;
let queue = Promise.resolve();

function toBrazilianNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`; // DDD + número
  return digits;
}

async function sendText(to, text) {
  if (status !== "conectado" || !sock) throw new Error("WhatsApp não está conectado (leia o QR code na página do serviço).");
  const number = toBrazilianNumber(to);
  if (number.length < 12) throw new Error("Número de destino inválido. Use DDD + número, ex.: 35999998888.");

  // Resolve o número como o WhatsApp conhece (alguns DDDs não têm o 9 extra).
  const [found] = await sock.onWhatsApp(number);
  if (!found?.exists) throw new Error(`O número ${number} não tem WhatsApp.`);

  const wait = lastSentAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  await sock.sendMessage(found.jid, { text });
  lastSentAt = Date.now();
}

// Uma mensagem por vez, na ordem em que chegaram.
function enqueue(to, text) {
  const job = queue.then(() => sendText(to, text));
  queue = job.catch(() => {});
  return job;
}

// ---------------------------------------------------------------- http

function validToken(value) {
  const a = Buffer.from(String(value || ""));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 20_000) reject(new Error("Mensagem grande demais."));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
  });
}

async function statusPage(token) {
  const qrImage = qr ? await QRCode.toDataURL(qr, { width: 320, margin: 1 }) : null;
  const warning =
    persistent === false
      ? `<p class="warn">⚠️ A sessão não está salva num volume: todo reinício do servidor vai pedir o QR de novo.</p>`
      : "";
  const last =
    lastDisconnect && status !== "conectado"
      ? `<p class="muted">Última desconexão: ${lastDisconnect.reason}</p>`
      : "";
  const body =
    status === "conectado"
      ? `<p class="ok">✅ Conectado como <b>+${me}</b></p>
         <p>Os avisos de pedido saem deste WhatsApp.</p>
         <form method="post" action="/logout?token=${encodeURIComponent(token)}"
               onsubmit="return confirm('Desconectar este WhatsApp?')">
           <button>Desconectar</button>
         </form>`
      : qrImage
        ? `<p>No celular: <b>WhatsApp → ⋮ (ou Configurações) → Aparelhos conectados → Conectar um aparelho</b> e aponte a câmera pro código.</p>
           <img src="${qrImage}" alt="QR code" width="320" height="320" />
           <p class="muted">O código muda sozinho a cada ~20 segundos. A página atualiza sozinha.</p>`
        : `<p class="muted">${status === "reconectando" ? "Reconectando..." : "Iniciando..."} aguarde alguns segundos.</p>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${status === "conectado" ? "" : '<meta http-equiv="refresh" content="5" />'}
  <title>Avisos por WhatsApp</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1224;color:#e2e8f0;font-family:system-ui,sans-serif;padding:16px}
    .card{background:#111c38;border:1px solid #1e2b4d;border-radius:18px;padding:28px;max-width:420px;text-align:center}
    h1{margin:0 0 12px;font-size:22px;color:#fff} img{background:#fff;border-radius:12px;padding:8px;max-width:100%;height:auto}
    .ok{font-size:18px;color:#86efac} .muted{color:#94a3b8;font-size:13px}
    .warn{background:#3b2a06;border:1px solid #854d0e;color:#fcd34d;border-radius:10px;padding:8px 10px;font-size:13px}
    button{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;margin-top:8px}
  </style></head><body><div class="card"><h1>Avisos de pedido por WhatsApp</h1>${warning}${body}${last}</div></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      if (!validToken(url.searchParams.get("token"))) {
        res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Acesso negado. Abra pelo link do painel da loja.");
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(await statusPage(url.searchParams.get("token")));
    }

    if (req.method === "GET" && url.pathname === "/health") {
      if (!validToken(bearer(req))) return json(res, 401, { error: "Token inválido." });
      return json(res, 200, { status, number: me, persistent, lastDisconnect });
    }

    if (req.method === "POST" && url.pathname === "/send") {
      if (!validToken(bearer(req))) return json(res, 401, { error: "Token inválido." });
      const { to, text } = await readBody(req);
      if (!to || !text) return json(res, 400, { error: "Informe 'to' e 'text'." });
      await enqueue(to, String(text).slice(0, 4000));
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/logout") {
      if (!validToken(url.searchParams.get("token"))) return json(res, 401, { error: "Token inválido." });
      await sock?.logout().catch(() => {});
      res.writeHead(303, { Location: `/?token=${encodeURIComponent(url.searchParams.get("token"))}` });
      return res.end();
    }

    json(res, 404, { error: "Não encontrado." });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, () => console.log(`Serviço de avisos no ar na porta ${PORT} (sessão em ${path.resolve(AUTH_DIR)})`));
connect().catch((err) => {
  console.error("Falha ao conectar no WhatsApp:", err);
  scheduleReconnect(5000);
});

// Um erro solto da biblioteca não pode derrubar o serviço.
process.on("unhandledRejection", (err) => console.error("Erro não tratado:", err));

// Deploy/reinício do Railway: termina de salvar a sessão e fecha a conexão
// SEM deslogar, pra voltar conectado sem precisar de QR.
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} recebido: salvando a sessão e encerrando...`);
  clearTimeout(reconnectTimer);
  const done = (async () => {
    await pendingSave;
    try {
      sock?.end(undefined);
    } catch {
      // já estava fechada
    }
    await pendingSave;
  })();
  await Promise.race([done, new Promise((r) => setTimeout(r, 5000))]);
  server.close();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
