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

// Endereço atual da API e o antigo (algumas contas/integrações ainda usam).
const BASE_URLS = process.env.INFINITEPAY_API_URL
  ? [process.env.INFINITEPAY_API_URL]
  : ["https://api.checkout.infinitepay.io", "https://api.infinitepay.io/invoices/public/checkout"];

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

/** Tenta o endereço atual e, se ele recusar, o antigo. Guarda qual funcionou. */
let workingBase: string | null = null;
async function post(path: string, body: unknown) {
  const bases = workingBase ? [workingBase, ...BASE_URLS.filter((b) => b !== workingBase)] : BASE_URLS;
  const errors: string[] = [];
  for (const base of bases) {
    try {
      const data = await postTo(base, path, body);
      workingBase = base;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${base}${path} → ${message}`);
      // eslint-disable-next-line no-console
      console.warn("[infinitepay]", errors[errors.length - 1]);
    }
  }
  throw new Error(errors.join(" | "));
}

async function postTo(base: string, path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
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
  const base = {
    handle: tag,
    order_nsu: params.orderId,
    redirect_url: params.redirectUrl,
    webhook_url: params.webhookUrl,
    items: params.items.map((i) => ({
      quantity: i.quantity,
      price: i.priceCents, // em centavos
      description: i.description.slice(0, 120),
    })),
  };
  const customer = params.customer
    ? {
        name: params.customer.name,
        email: params.customer.email,
        phone_number: phone ? (phone.startsWith("55") ? `+${phone}` : `+55${phone}`) : undefined,
      }
    : undefined;
  let data: Record<string, unknown>;
  try {
    data = await post("/links", customer ? { ...base, customer } : base);
  } catch (err) {
    if (!customer) throw err;
    // Dados do cliente são opcionais: se a InfinitePay recusar o formato, tenta sem eles.
    // eslint-disable-next-line no-console
    console.warn("[infinitepay] tentando o link sem os dados do cliente");
    data = await post("/links", base);
  }
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
