/**
 * Checkout Integrado da InfinitePay (Pix e cartão). O site cria um link de
 * pagamento pro pedido, o cliente paga na página da InfinitePay e volta pro
 * site. A confirmação chega pelo webhook e pelo retorno do cliente — e nos
 * dois casos é conferida direto na InfinitePay (payment_check), porque o
 * webhook não vem assinado.
 *
 * Variáveis: INFINITEPAY_HANDLE (a InfiniteTag da conta, sem o "$") e
 * INFINITEPAY_API_KEY (chave da API, enviada no header X-Api-Key).
 */

const BASE_URL = process.env.INFINITEPAY_API_URL || "https://api.checkout.infinitepay.io";

export function infinitepayConfigured() {
  return Boolean(handle());
}

function handle() {
  return (process.env.INFINITEPAY_HANDLE ?? "").trim().replace(/^\$/, "");
}

function headers() {
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.INFINITEPAY_API_KEY) h["X-Api-Key"] = process.env.INFINITEPAY_API_KEY;
  return h;
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`InfinitePay ${res.status}: ${detail.slice(0, 300)}`);
  }
  return data as Record<string, unknown>;
}

export type CheckoutItem = { description: string; quantity: number; priceCents: number };

/** Cria o link de pagamento do pedido e devolve o endereço dele. */
export async function createCheckoutLink(params: {
  orderId: string;
  items: CheckoutItem[];
  redirectUrl: string;
  webhookUrl: string;
  customer?: { name?: string; email?: string; phone?: string };
}) {
  const tag = handle();
  if (!tag) throw new Error("INFINITEPAY_HANDLE não configurado.");
  const phone = params.customer?.phone?.replace(/\D/g, "");
  const data = await post("/links", {
    handle: tag,
    order_nsu: params.orderId,
    redirect_url: params.redirectUrl,
    webhook_url: params.webhookUrl,
    items: params.items.map((i) => ({
      quantity: i.quantity,
      price: i.priceCents, // em centavos
      description: i.description.slice(0, 120),
    })),
    customer: params.customer
      ? {
          name: params.customer.name,
          email: params.customer.email,
          phone_number: phone ? (phone.startsWith("55") ? `+${phone}` : `+55${phone}`) : undefined,
        }
      : undefined,
  });
  // As fontes divergem no nome do campo: aceita os mais comuns.
  const url = [data?.url, data?.checkout_url, data?.link, data?.payment_url].find(
    (v): v is string => typeof v === "string" && v.startsWith("http")
  );
  if (!url) throw new Error(`InfinitePay não devolveu o link: ${JSON.stringify(data).slice(0, 300)}`);
  return url;
}

export type PaymentCheck = { paid: boolean; amountCents: number | null; captureMethod: string | null };

/** Confere na InfinitePay se a transação do pedido foi paga. */
export async function checkPayment(params: { orderId: string; transactionNsu: string; slug: string }): Promise<PaymentCheck> {
  const data = await post("/payment_check", {
    handle: handle(),
    order_nsu: params.orderId,
    transaction_nsu: params.transactionNsu,
    slug: params.slug,
  });
  const amount = Number(data?.amount);
  return {
    paid: data?.success === true && data?.paid === true,
    amountCents: Number.isFinite(amount) ? amount : null,
    captureMethod: typeof data?.capture_method === "string" ? data.capture_method : null,
  };
}
