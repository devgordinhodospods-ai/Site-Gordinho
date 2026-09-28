import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

function getClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado no ambiente.");
  }
  return new MercadoPagoConfig({ accessToken });
}

export type PreferenceItemInput = {
  title: string;
  quantity: number;
  unitPriceCents: number;
};

/**
 * Cria uma preferência de pagamento no Checkout Pro do Mercado Pago.
 * O carrinho é montado igual um app de delivery: itens do pedido + linha de
 * frete + linha de taxa de serviço, cada uma como um "item" da preferência.
 */
export async function createPaymentPreference(params: {
  orderId: string;
  items: PreferenceItemInput[];
  shippingFeeCents: number;
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

  if (params.shippingFeeCents > 0) {
    items.push({
      id: "shipping-fee",
      title: "Taxa de entrega",
      quantity: 1,
      unit_price: params.shippingFeeCents / 100,
      currency_id: "BRL",
    });
  }

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
    },
  });

  return result;
}

export async function getPayment(paymentId: string | number) {
  const client = getClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}
