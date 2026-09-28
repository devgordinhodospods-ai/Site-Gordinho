import { ShieldCheck, CreditCard, Truck, MessageCircle } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, label: "Compra 100% segura" },
  { icon: CreditCard, label: "Pagamento via Mercado Pago" },
  { icon: Truck, label: "Frete calculado por região" },
  { icon: MessageCircle, label: "Atendimento via WhatsApp" },
];

export function TrustTicker() {
  const content = (
    <>
      {ITEMS.map((item, i) => (
        <div key={i} className="flex items-center gap-2 whitespace-nowrap px-6 text-sm font-bold text-white">
          <item.icon size={16} />
          {item.label}
        </div>
      ))}
    </>
  );

  return (
    <div className="overflow-hidden bg-brand-dark py-2.5" style={{ background: "#0f2f8f" }}>
      <div className="marquee-track">
        {content}
        {content}
      </div>
    </div>
  );
}
