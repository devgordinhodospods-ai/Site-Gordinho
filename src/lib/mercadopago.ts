import { MercadoPagoConfig, Order, Preference, Payment } from "mercadopago";

function getClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado no ambiente.");
  }
  return new MercadoPagoConfig({ accessToken });
}

/** Data no formato dos exemplos da API do Mercado Pago, no horário de Brasília. */
function toMercadoPagoDate(date: Date) {
  const brasilia = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return brasilia.toISOString().replace("Z", "-03:00");
}

export type PreferenceItemInput = {
  title: string;
  quantity: number;
  unitPriceCents: number;
};

/**
 * Cria uma preferência de pagamento no Checkout Pro do Mercado Pago.
 * O frete NÃO entra aqui: é pago em dinheiro/pix direto pro
 * entregador no momento da entrega, então o valor cobrado no site é só o
 * produto + a taxa de serviço da loja.
 */
export async function createPaymentPreference(params: {
  orderId: string;
  items: PreferenceItemInput[];
  serviceFeeCents: number;
  payerEmail?: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
  expiresAt: Date;
}) {
  const client = getClient();
  const preference = new Preference(client);

  const items = [
    ...params.items.map((item, index) => ({
      id: `item-${index}`,
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unitPriceCents / 100,
      currency_id: "BRL",
    })),
  ];

  if (params.serviceFeeCents > 0) {
    items.push({
      id: "service-fee",
      title: "Taxa de serviço",
      quantity: 1,
      unit_price: params.serviceFeeCents / 100,
      currency_id: "BRL",
    });
  }

  const result = await preference.create({
    body: {
      items,
      external_reference: params.orderId,
      payer: params.payerEmail ? { email: params.payerEmail } : undefined,
      back_urls: {
        success: params.successUrl,
        failure: params.failureUrl,
        pending: params.pendingUrl,
      },
      auto_return: "approved",
      notification_url: params.notificationUrl,
      // Link e Pix expiram junto com a reserva do estoque; depois disso o
      // pedido abandonado é cancelado (ver releaseAbandonedOrders).
      expires: true,
      expiration_date_from: toMercadoPagoDate(new Date()),
      expiration_date_to: toMercadoPagoDate(params.expiresAt),
      date_of_expiration: toMercadoPagoDate(params.expiresAt),
    },
  });

  return result;
}

type PixParams = {
  orderId: string;
  amountCents: number;
  description: string;
  payer: { email: string; firstName?: string; lastName?: string; cpf?: string | null };
  notificationUrl: string;
  expiresAt: Date;
};

type PixCharge = { id: string; qrCode: string; ticketUrl: string | null };

/**
 * O Mercado Pago só aceita Pix com validade de no mínimo 30 minutos,
 * contados quando o pedido chega lá. +2 min de folga pra nunca ficar
 * abaixo disso (o site cancela o pedido pelo próprio cronômetro).
 */
function pixExpiration(expiresAt: Date) {
  return new Date(Math.max(expiresAt.getTime(), Date.now() + 30 * 60 * 1000) + 2 * 60 * 1000);
}

/** Pix pela API de Payments (/v1/payments). */
async function createPixViaPayments(params: PixParams): Promise<PixCharge> {
  const payment = new Payment(getClient());
  const cpf = params.payer.cpf?.replace(/\D/g, "");
  const result = await payment.create({
    body: {
      transaction_amount: params.amountCents / 100,
      description: params.description,
      payment_method_id: "pix",
      external_reference: params.orderId,
      notification_url: params.notificationUrl,
      date_of_expiration: toMercadoPagoDate(pixExpiration(params.expiresAt)),
      payer: {
        email: params.payer.email,
        first_name: params.payer.firstName,
        last_name: params.payer.lastName,
        identification: cpf?.length === 11 ? { type: "CPF", number: cpf } : undefined,
      },
    },
    // Mesmo pedido nunca gera dois Pix, nem se a requisição for repetida.
    requestOptions: { idempotencyKey: `pix-${params.orderId}` },
  });

  const data = result.point_of_interaction?.transaction_data;
  if (!result.id || !data?.qr_code) throw new Error("Mercado Pago não devolveu o QR code do Pix.");
  return { id: String(result.id), qrCode: data.qr_code, ticketUrl: data.ticket_url ?? null };
}

/**
 * Pix pela API de Orders (/v1/orders) — o modelo das aplicações novas
 * "Checkout Transparente via Orders". O id devolvido começa com "ORD".
 */
async function createPixViaOrders(params: PixParams): Promise<PixCharge> {
  const order = new Order(getClient());
  const cpf = params.payer.cpf?.replace(/\D/g, "");
  const amount = (params.amountCents / 100).toFixed(2);
  const minutes = Math.ceil((pixExpiration(params.expiresAt).getTime() - Date.now()) / 60000);
  const result = await order.create({
    body: {
      type: "online",
      processing_mode: "automatic",
      total_amount: amount,
      external_reference: params.orderId,
      description: params.description,
      payer: {
        email: params.payer.email,
        first_name: params.payer.firstName,
        last_name: params.payer.lastName,
        identification: cpf?.length === 11 ? { type: "CPF", number: cpf } : undefined,
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: { id: "pix", type: "bank_transfer" },
            expiration_time: `PT${minutes}M`,
          },
        ],
      },
    },
    requestOptions: { idempotencyKey: `pix-order-${params.orderId}` },
  });

  const method = result.transactions?.payments?.[0]?.payment_method;
  if (!result.id || !method?.qr_code) throw new Error("Mercado Pago (Orders) não devolveu o QR code do Pix.");
  return { id: String(result.id), qrCode: method.qr_code, ticketUrl: method.ticket_url ?? null };
}

/**
 * Cria o Pix do pedido (QR code + copia e cola + link). Tenta a API de
 * Payments e, se o Mercado Pago recusar (ex.: aplicação criada como
 * "Checkout Transparente via Orders"), a API de Orders.
 */
export async function createPixPayment(params: PixParams): Promise<PixCharge> {
  try {
    return await createPixViaPayments(params);
  } catch (paymentsErr) {
    try {
      return await createPixViaOrders(params);
    } catch (ordersErr) {
      // eslint-disable-next-line no-console
      console.error("[pix] Payments:", describeMercadoPagoError(paymentsErr).detail);
      // eslint-disable-next-line no-console
      console.error("[pix] Orders:", describeMercadoPagoError(ordersErr).detail);
      throw ordersErr;
    }
  }
}

/** Status de um Pix no formato usado pelo site, seja da API de Payments ou de Orders. */
export type PaymentState = {
  id: string;
  /** "approved" = pago · "cancelled" = vencido/cancelado · outros = aguardando */
  status: string;
  external_reference: string | null;
};

export async function getPaymentState(id: string): Promise<PaymentState> {
  if (id.startsWith("ORD")) {
    const order = await new Order(getClient()).get({ id });
    const pay = order.transactions?.payments?.[0];
    const paid =
      order.status === "processed" ||
      pay?.status === "processed" ||
      pay?.status === "approved" ||
      pay?.status_detail === "accredited";
    const cancelled = ["expired", "canceled", "cancelled", "failed", "refunded"].includes(order.status ?? "");
    return {
      id,
      status: paid ? "approved" : cancelled ? "cancelled" : order.status ?? "pending",
      external_reference: order.external_reference ?? null,
    };
  }
  const payment = await getPayment(id);
  return { id: String(payment.id), status: payment.status ?? "pending", external_reference: payment.external_reference ?? null };
}

export async function getPayment(paymentId: string | number) {
  const client = getClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

/**
 * Transforma o erro da API do Mercado Pago numa mensagem que ajuda a
 * resolver (ex.: conta sem chave Pix), sem esconder o detalhe técnico.
 */
export function describeMercadoPagoError(err: unknown): { message: string; detail: string } {
  const e = (err ?? {}) as {
    message?: string;
    error?: string;
    status?: number;
    cause?: { code?: string | number; description?: string }[] | unknown;
  };
  const causes = Array.isArray(e.cause) ? (e.cause as { code?: string | number; description?: string }[]) : [];
  const detail =
    [e.status, e.error, e.message, ...causes.map((c) => [c.code, c.description].filter(Boolean).join(" "))]
      .filter(Boolean)
      .join(" | ") || String(err);

  let message: string;
  if (/MERCADOPAGO_ACCESS_TOKEN/.test(detail)) {
    message = "O pagamento ainda não foi configurado na loja (falta o Access Token do Mercado Pago na Vercel).";
  } else if (/key enabled for QR|without key|pix key|chave pix/i.test(detail)) {
    message =
      "A conta do Mercado Pago da loja ainda não tem chave Pix cadastrada (no app: Pix → Minhas chaves → Cadastrar chave).";
  } else if (/collector|same user|invalid users involved|yourself|payer_email/i.test(detail)) {
    message =
      "Esta conta usa o mesmo e-mail da conta do Mercado Pago da loja, e o Mercado Pago não deixa pagar pra si mesmo. Faça o teste com outra conta do site.";
  } else if (/live credentials/i.test(detail)) {
    message = `O Mercado Pago ainda não liberou as credenciais de produção pra receber Pix por API (Mercado Pago: ${detail}).`;
  } else if (/invalid access token|invalid_token|invalid credentials|malformed access token/i.test(detail)) {
    message = `O Access Token do Mercado Pago configurado na Vercel é inválido ou foi renovado (Mercado Pago: ${detail}).`;
  } else {
    message = `Não foi possível gerar o Pix agora (Mercado Pago: ${detail}). Tente de novo em instantes.`;
  }
  return { message, detail };
}

export type MercadoPagoDiagnostics = {
  tokenType: "produção" | "teste" | "desconhecido";
  account: { id: number; nickname: string | null; email: string | null; siteId: string | null } | null;
  accountError: string | null;
  pixAvailable: boolean | null;
  methods: string[];
};

/**
 * Pergunta ao Mercado Pago de qual conta é o Access Token e se essa conta
 * pode receber Pix — pra descobrir por que o Pix é recusado.
 */
export async function mercadoPagoDiagnostics(): Promise<MercadoPagoDiagnostics> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
  const headers = { Authorization: `Bearer ${token}` };
  const tokenType = token.startsWith("APP_USR-") ? "produção" : token.startsWith("TEST-") ? "teste" : "desconhecido";

  const result: MercadoPagoDiagnostics = { tokenType, account: null, accountError: null, pixAvailable: null, methods: [] };
  if (!token) {
    result.accountError = "MERCADOPAGO_ACCESS_TOKEN não está configurado na Vercel.";
    return result;
  }

  try {
    const res = await fetch("https://api.mercadopago.com/users/me", { headers, cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      result.account = { id: data.id, nickname: data.nickname ?? null, email: data.email ?? null, siteId: data.site_id ?? null };
    } else {
      result.accountError = `${res.status} ${data.message ?? data.error ?? ""}`.trim();
    }
  } catch (err) {
    result.accountError = err instanceof Error ? err.message : String(err);
  }

  try {
    const res = await fetch("https://api.mercadopago.com/v1/payment_methods", { headers, cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) {
      result.methods = data.filter((m) => m.status === "active").map((m) => String(m.id));
      result.pixAvailable = result.methods.includes("pix");
    }
  } catch {
    // fica null: não deu pra consultar
  }
  return result;
}
