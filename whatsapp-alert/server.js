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

import http from "node:http";
import { rm } from "node:fs/promises";
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
const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const MIN_INTERVAL_MS = 4000; // espaço mínimo entre mensagens (evita cara de robô)

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

async function connect() {
  clearTimeout(reconnectTimer);
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  sock = makeWASocket({
    auth: state,
    version,
    logger,
    browser: Browsers.ubuntu("Avisos da loja"),
    markOnlineOnConnect: false, // não aparece "online" no celular dele
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      qr = update.qr;
      status = "aguardando_qr";
    }
    if (update.connection === "open") {
      qr = null;
      status = "conectado";
      me = (sock.user?.id || "").split(":")[0].split("@")[0] || null;
      console.log(`Conectado como +${me}`);
    }
    if (update.connection === "close") {
      const code = update.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        // Desconectado pelo celular (Aparelhos conectados → sair): apaga a sessão e gera QR novo.
        console.log("Sessão encerrada no celular. Gerando QR novo...");
        await rm(AUTH_DIR, { recursive: true, force: true });
        me = null;
        status = "iniciando";
      } else {
        status = "reconectando";
      }
      reconnectTimer = setTimeout(() => connect().catch(console.error), 3000);
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
    button{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;margin-top:8px}
  </style></head><body><div class="card"><h1>Avisos de pedido por WhatsApp</h1>${body}</div></body></html>`;
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
      return json(res, 200, { status, number: me });
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

server.listen(PORT, () => console.log(`Serviço de avisos no ar na porta ${PORT}`));
connect().catch((err) => {
  console.error("Falha ao conectar no WhatsApp:", err);
  reconnectTimer = setTimeout(() => connect().catch(console.error), 5000);
});
