# Avisos de pedido por WhatsApp

Serviço pequeno que fica conectado a um WhatsApp (o particular do dono), igual
ao WhatsApp Web, e manda uma mensagem pro WhatsApp da loja a cada pedido pago.

Precisa ficar ligado o tempo todo, por isso roda fora da Vercel (no Railway).

## Subir no Railway

1. **railway.app → New Project → Deploy from GitHub repo** → escolha o repositório do site.
2. No serviço criado: **Settings → Source → Root Directory** = `whatsapp-alert`.
   Em **Watch Paths**, coloque `whatsapp-alert/**` (assim ele só reinicia quando este serviço mudar).
3. **Variables**:
   - `ALERT_TOKEN` = uma senha longa (mínimo 16 caracteres). É a mesma que vai na Vercel.
   - `AUTH_DIR` = `/data/auth`
4. **Volume**: no projeto, **+ Create → Volume**, ligado a este serviço, com **Mount Path** `/data`.
   (Guarda a sessão do WhatsApp: sem ele, cada deploy pede o QR code de novo.)
5. **Settings → Networking → Generate Domain** e copie o endereço (ex.: `https://avisos-xxxx.up.railway.app`).

## Ligar no site (Vercel)

Em **Settings → Environment Variables** do projeto do site:

- `WHATSAPP_ALERT_URL` = o endereço do Railway (sem barra no final)
- `WHATSAPP_ALERT_TOKEN` = a mesma senha do `ALERT_TOKEN`

Depois, **Redeploy**.

## Conectar o WhatsApp

No painel da loja: **Configurações → Avisos → Abrir QR code**. No celular do dono:
**WhatsApp → Aparelhos conectados → Conectar um aparelho** e leia o código.
Coloque o WhatsApp da loja no campo, **Salvar configurações** e **Enviar teste**.

## Rotas

| Rota | O que faz |
|---|---|
| `GET /?token=...` | Página com o QR code / status |
| `GET /health` | Status em JSON (`Authorization: Bearer <token>`) |
| `POST /send` | `{ "to": "35999998888", "text": "..." }` (`Authorization: Bearer <token>`) |
| `POST /logout?token=...` | Desconecta o WhatsApp |

## Se desconectar

- O serviço só pede QR novo quando o WhatsApp encerra a sessão de verdade (3
  tentativas seguidas). Quedas de internet, deploys e reinícios reconectam
  sozinhos, desde que a sessão esteja no **volume** (passo 4). Se não estiver,
  o painel e a página do QR mostram um aviso amarelo.
- O painel mostra o motivo da última desconexão; os logs do Railway também
  ("Conexão fechada (código ...)").
- Enquanto estiver desconectado, os avisos de pedido vão por **e-mail** pros
  endereços de `ADMIN_EMAILS` (Vercel), e o cron diário manda um lembrete.
- O próprio WhatsApp desconecta aparelhos se o celular do dono ficar mais de
  ~14 dias sem internet, ou se alguém tirar em **Aparelhos conectados**.

Mensagens saem uma por vez, com pelo menos 4 segundos entre elas, e só pro
número da loja — uso bem baixo, sem cara de disparo em massa.
