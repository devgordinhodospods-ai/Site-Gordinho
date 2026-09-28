import { ShieldCheck, QrCode, Truck, MessageCircle } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, label: "Compra 100% segura" },
  { icon: QrCode, label: "Pagamento via Pix" },
  { icon: Truck, label: "Frete calculado por região" },
  { icon: MessageCircle, label: "Atendimento via WhatsApp" },
];

// A faixa animada precisa ser mais larga que qualquer tela pra nunca sobrar
// espaço vazio no meio do loop (o que fazia parecer que ela "teleportava").
// Repete os itens várias vezes antes de duplicar o bloco inteiro — com só
// uma cópia dos 4 itens, em telas largas a faixa ficava mais estreita que a
// tela e aparecia um vão em branco antes de reiniciar.
const STRIP_REPEATS = 6;

export function TrustTicker() {
  const strip = (
    <>
      {Array.from({ length: STRIP_REPEATS }).map((_, s) =>
        ITEMS.map((item, i) => (
          <div
            key={`${s}-${i}`}
            className="flex items-center gap-2 whitespace-nowrap px-6 text-sm font-bold text-white"
          >
            <item.icon size={16} />
            {item.label}
          </div>
        ))
      )}
    </>
  );

  return (
    <div className="overflow-hidden bg-brand-dark py-2.5" style={{ background: "#0f2f8f" }}>
      <div className="marquee-track">
        {strip}
        {strip}
      </div>
    </div>
  );
}
