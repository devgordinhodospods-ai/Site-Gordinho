import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

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

/**
 * Cria um pagamento Pix direto (sem sair do site): devolve o "copia e
 * cola" pro QR code e o link da página de pagamento do Mercado Pago.
 */
export async function createPixPayment(params: {
  orderId: string;
  amountCents: number;
  description: string;
  payer: { email: string; firstName?: string; lastName?: string; cpf?: string | null };
  notificationUrl: string;
  expiresAt: Date;
}) {
  const payment = new Payment(getClient());
  const cpf = params.payer.cpf?.replace(/\D/g, "");
  // O Mercado Pago só aceita Pix com validade de no mínimo 30 minutos,
  // contados quando o pedido chega lá. +2 min de folga pra nunca ficar
  // abaixo disso (o site cancela o pedido pelo próprio cronômetro).
  const pixExpiresAt = new Date(Math.max(params.expiresAt.getTime(), Date.now() + 30 * 60 * 1000) + 2 * 60 * 1000);
  const result = await payment.create({
    body: {
      transaction_amount: params.amountCents / 100,
      description: params.description,
      payment_method_id: "pix",
      external_reference: params.orderId,
      notification_url: params.notificationUrl,
      date_of_expiration: toMercadoPagoDate(pixExpiresAt),
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
