import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { PAYMENT_WINDOW_MS } from "@/lib/orders";

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
 * O frete NÃO entra aqui: é uma estimativa paga em dinheiro/pix direto pro
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
      expiration_date_to: toMercadoPagoDate(new Date(Date.now() + PAYMENT_WINDOW_MS)),
      date_of_expiration: toMercadoPagoDate(new Date(Date.now() + PAYMENT_WINDOW_MS)),
    },
  });

  return result;
}

export async function getPayment(paymentId: string | number) {
  const client = getClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}
