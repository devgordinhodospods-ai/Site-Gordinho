"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { Clock, Home, Mail, Percent, Phone, Store, type LucideIcon } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { centsToBRL } from "@/lib/money";
import { closedMessage, getStoreStatus, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/storeHours";
import { FileInput } from "@/components/ui/FileInput";
import { HelpTip } from "@/components/ui/HelpTip";
import { Loader } from "@/components/ui/Loader";
import { EmailTestCard } from "@/components/admin/EmailTestCard";
import { ClosedStoreCard } from "@/components/layout/ClosedStorePopup";
import type { SiteSettings } from "@/lib/types";

type ImageKind = "logo" | "favicon" | "footer" | "hero";
type TabId = "loja" | "home" | "contato" | "horario" | "taxas" | "emails";

const TABS: { id: TabId; label: string; icon: LucideIcon; description: string }[] = [
  { id: "loja", label: "Loja", icon: Store, description: "Nome, logo e ícone da aba do navegador." },
  { id: "home", label: "Página inicial", icon: Home, description: "Faixa de avisos do topo e banner da vitrine." },
  { id: "contato", label: "Rodapé e contato", icon: Phone, description: "Imagem do rodapé, WhatsApp, e-mail e Instagram." },
  { id: "horario", label: "Horário e loja fechada", icon: Clock, description: "Aviso pro cliente quando a loja não está funcionando." },
  { id: "taxas", label: "Taxas", icon: Percent, description: "Taxa de serviço cobrada junto com os produtos." },
  { id: "emails", label: "E-mails", icon: Mail, description: "Teste os e-mails que o cliente recebe." },
];

const IMAGE_FIELD: Record<ImageKind, keyof SiteSettings> = {
  logo: "store_logo_url",
  favicon: "store_favicon_url",
  footer: "footer_image_url",
  hero: "hero_image_url",
};

function Field({ label, help, children, hint }: { label: string; help: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800">
        {label}
        <HelpTip text={help} />
      </label>
      {hint && <p className="mb-1.5 text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left text-sm text-slate-800"
    >
      <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-slate-300"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}

export function SettingsManager() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<TabId>("loja");
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi<{ settings: { key: string; value: unknown }[] }>("getSettings").then(({ settings: rows }) => {
      const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
      for (const row of rows) merged[row.key] = row.value;
      setSettings(merged as SiteSettings);
      setSaved(JSON.stringify(merged));
      setLoaded(true);
    });
  }, []);

  const dirty = loaded && JSON.stringify(settings) !== saved;
  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  async function handleUpload(file: File, kind: ImageKind) {
    setUploading(kind);
    setError(null);
    try {
      const path = `store/${kind}-${Date.now()}`;
      const { upload } = await adminApi<{ upload: { path: string; token: string } }>("createUploadUrl", { path });
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .uploadToSignedUrl(upload.path, upload.token, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("product-images").getPublicUrl(upload.path);
      setSettings((s) => ({ ...s, [IMAGE_FIELD[kind]]: data.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await adminApi("saveSettings", { fields: settings });
      setSaved(JSON.stringify(settings));
      setMessage("Configurações salvas! O site já está atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  function imageField(kind: ImageKind, opts: { label: string; help: string; hint?: string; preview: string }) {
    const url = settings[IMAGE_FIELD[kind]] as string | null;
    return (
      <Field label={opts.label} help={opts.help} hint={opts.hint}>
        {url && (
          <div className={`relative mb-2 overflow-hidden rounded-lg border ${opts.preview}`}>
            <Image src={url} alt={opts.label} fill className="object-contain" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <FileInput
            onFileSelected={(file) => handleUpload(file, kind)}
            disabled={uploading === kind}
            label={uploading === kind ? "Enviando..." : url ? "Trocar imagem" : "Escolher imagem"}
          />
          {url && (
            <button
              type="button"
              className="text-xs text-red-600 hover:underline"
              onClick={() => setSettings((s) => ({ ...s, [IMAGE_FIELD[kind]]: null }))}
            >
              Remover imagem
            </button>
          )}
        </div>
      </Field>
    );
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <Loader />
      </div>
    );
  }

  const current = TABS.find((t) => t.id === tab)!;
  const status = getStoreStatus({ ...settings, closed_popup_enabled: true });
  const previewNextOpen = status.closed ? status.nextOpen : "amanhã (segunda-feira)";

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl text-slate-900">Configurações</h1>
      <p className="mb-5 text-sm text-slate-500">Tudo que aparece no site pro cliente, separado por assunto.</p>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              tab === id
                ? "border-transparent bg-brand text-white shadow-brand"
                : "border-blue-100 bg-white text-slate-700 hover:border-brand hover:text-brand"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-lg text-slate-900">{current.label}</h2>
        <p className="mb-5 text-sm text-slate-500">{current.description}</p>

        {tab === "loja" && (
          <div className="space-y-6">
            <Field
              label="Nome da loja"
              help="Nome exibido no título da aba do navegador, no rodapé e nos e-mails. Na navbar ele só aparece se não tiver logo."
            >
              <input className="input sm:max-w-md" value={settings.store_name} onChange={(e) => set("store_name", e.target.value)} />
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              {imageField("logo", {
                label: "Logo",
                help: "Aparece na navbar (topo do site) e no rodapé, se não tiver uma imagem própria de rodapé.",
                preview: "h-20 w-40 bg-slate-50",
              })}
              {imageField("favicon", {
                label: "Favicon",
                help: "Iconezinho que aparece na aba do navegador, ao lado do título da página. Use uma imagem quadrada.",
                preview: "h-10 w-10 bg-slate-50",
              })}
            </div>
          </div>
        )}

        {tab === "home" && (
          <div className="space-y-6">
            <Field
              label="Faixa de avisos (topo do site)"
              help="Frase fixa exibida na faixa azul bem no topo de todas as páginas, acima da navbar. Deixe vazio pra esconder."
            >
              <input
                className="input"
                placeholder="Ex: Compra 100% segura • Pagamento via Pix"
                value={settings.announcement_text ?? ""}
                onChange={(e) => set("announcement_text", e.target.value || null)}
              />
            </Field>
            {imageField("hero", {
              label: "Banner da vitrine",
              help: "Imagem exibida no topo da página inicial, em fundo preto.",
              hint: "Tamanho ideal: imagem larga (ex.: 1600 × 500 px).",
              preview: "h-28 w-full max-w-xl bg-black",
            })}
          </div>
        )}

        {tab === "contato" && (
          <div className="space-y-6">
            {imageField("footer", {
              label: "Imagem do rodapé",
              help: "Imagem exibida no rodapé do site, ao lado do nome da loja.",
              hint: "Opcional: sem ela, o rodapé usa a logo.",
              preview: "h-16 w-32 bg-slate-900",
            })}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="WhatsApp" help="Número do botão de WhatsApp do rodapé e dos e-mails. Coloque com DDD (ex: 11999998888).">
                <input
                  className="input"
                  inputMode="tel"
                  placeholder="11999998888"
                  value={settings.contact_whatsapp ?? ""}
                  onChange={(e) => set("contact_whatsapp", e.target.value)}
                />
              </Field>
              <Field label="E-mail de contato" help="E-mail exibido pro cliente no rodapé e nos e-mails. Não é o e-mail de login do admin.">
                <input
                  className="input"
                  type="email"
                  value={settings.contact_email ?? ""}
                  onChange={(e) => set("contact_email", e.target.value)}
                />
              </Field>
              <Field label="Instagram" help="Seu @ do Instagram (com ou sem @). Vira um link no rodapé do site.">
                <input
                  className="input"
                  placeholder="@sualoja"
                  value={settings.contact_instagram ?? ""}
                  onChange={(e) => set("contact_instagram", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {tab === "horario" && (
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <Toggle
                checked={settings.closed_popup_enabled}
                onChange={(v) => set("closed_popup_enabled", v)}
                label="Mostrar aviso quando a loja estiver fechada"
              />

              <div className={settings.closed_popup_enabled ? "space-y-6" : "pointer-events-none space-y-6 opacity-50"}>
                <Field
                  label="Dias em que a loja fica fechada"
                  help="Nesses dias, quem abrir o site vê o aviso e sabe que o pedido será entregue no próximo dia de funcionamento."
                >
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS_SHORT.map((day, i) => {
                      const closed = settings.closed_days.includes(i);
                      return (
                        <button
                          key={day}
                          type="button"
                          title={WEEKDAYS[i]}
                          aria-pressed={closed}
                          onClick={() =>
                            set(
                              "closed_days",
                              closed ? settings.closed_days.filter((d) => d !== i) : [...settings.closed_days, i].sort()
                            )
                          }
                          className={`h-10 w-12 rounded-xl border text-sm transition ${
                            closed
                              ? "border-transparent bg-slate-800 text-white"
                              : "border-blue-100 bg-white text-slate-700 hover:border-brand"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">Os escuros ficam fechados o dia todo.</p>
                </Field>

                <Field
                  label="Horário de funcionamento"
                  help="Opcional. Fora desse horário (nos dias abertos) o aviso também aparece. Deixe em branco se não quiser usar horário."
                >
                  <div className="flex items-center gap-2">
                    <input
                      className="input w-32"
                      type="time"
                      value={settings.open_time ?? ""}
                      onChange={(e) => set("open_time", e.target.value || null)}
                    />
                    <span className="text-sm text-slate-500">até</span>
                    <input
                      className="input w-32"
                      type="time"
                      value={settings.close_time ?? ""}
                      onChange={(e) => set("close_time", e.target.value || null)}
                    />
                  </div>
                </Field>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <Toggle
                    checked={settings.closed_manual}
                    onChange={(v) => set("closed_manual", v)}
                    label="Fechar a loja agora (feriado, folga, imprevisto)"
                  />
                  <p className="mt-1.5 pl-14 text-xs text-amber-800">
                    Mostra o aviso até você desligar aqui, mesmo em dia e horário normais.
                  </p>
                </div>

                <Field label="Título do aviso" help="Frase em destaque no topo do aviso.">
                  <input
                    className="input"
                    value={settings.closed_popup_title}
                    onChange={(e) => set("closed_popup_title", e.target.value)}
                  />
                </Field>
                <Field
                  label="Mensagem do aviso"
                  help="Use {proximo_dia} onde quiser que apareça quando o pedido será entregue — o site preenche sozinho (ex.: amanhã (segunda-feira))."
                >
                  <textarea
                    className="input min-h-[90px]"
                    value={settings.closed_popup_message}
                    onChange={(e) => set("closed_popup_message", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Prévia</p>
              <div className="flex justify-center rounded-2xl bg-slate-800/80 p-5">
                <ClosedStoreCard
                  title={settings.closed_popup_title || "Estamos fechados agora"}
                  message={closedMessage(settings, previewNextOpen)}
                  nextOpen={previewNextOpen}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {!settings.closed_popup_enabled
                  ? "Aviso desligado: o cliente não vê nada."
                  : status.closed
                    ? "Agora a loja está FECHADA: quem abrir o site vê esse aviso (uma vez por dia)."
                    : "Agora a loja está aberta: o aviso não aparece."}
              </p>
            </div>
          </div>
        )}

        {tab === "taxas" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Taxa de serviço (%)"
                help="Percentual cobrado em cima do subtotal do carrinho, junto com os produtos no Pix. Fica com a loja (entra no lucro do Monitoramento)."
              >
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.1"
                  value={settings.service_fee_percent}
                  onChange={(e) => set("service_fee_percent", Number(e.target.value))}
                />
              </Field>
              <Field label="Taxa de serviço fixa (R$)" help="Valor fixo somado em todo pedido, além do percentual. Pode deixar 0.">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.service_fee_fixed / 100}
                  onChange={(e) => set("service_fee_fixed", Math.round(Number(e.target.value) * 100))}
                />
              </Field>
            </div>
            <p className="rounded-xl bg-blue-50 p-3 text-sm text-slate-600">
              Exemplo: num carrinho de R$ 100,00 a taxa fica{" "}
              <strong className="text-brand">
                {centsToBRL(Math.round((10000 * settings.service_fee_percent) / 100) + settings.service_fee_fixed)}
              </strong>
              . O frete não entra aqui: é pago direto ao entregador.
            </p>
          </div>
        )}

        {tab === "emails" && <EmailTestCard />}
      </section>

      {tab !== "emails" && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-blue-100 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
            {!error && message && !dirty && <p className="mr-auto text-sm text-green-600">{message}</p>}
            {!error && dirty && <p className="mr-auto text-sm text-amber-700">Você tem alterações não salvas.</p>}
            <button className="btn-primary" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? <Loader size={18} color="#fff" /> : "Salvar configurações"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
