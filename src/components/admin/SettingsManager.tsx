"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { adminApi } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { FileInput } from "@/components/ui/FileInput";
import { HelpTip } from "@/components/ui/HelpTip";
import type { SiteSettings } from "@/lib/types";

export function SettingsManager() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [uploading, setUploading] = useState<"logo" | "favicon" | "footer" | "hero" | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { settings: rows } = await adminApi<{ settings: { key: string; value: unknown }[] }>(
      "getSettings"
    );
    const merged = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      (merged as Record<string, unknown>)[row.key] = row.value;
    }
    setSettings(merged);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(file: File, kind: "logo" | "favicon" | "footer" | "hero") {
    setUploading(kind);
    setError(null);
    try {
      const path = `store/${kind}-${Date.now()}`;
      const { upload } = await adminApi<{ upload: { path: string; token: string } }>("createUploadUrl", {
        path,
      });
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .uploadToSignedUrl(upload.path, upload.token, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(upload.path);
      const field = {
        logo: "store_logo_url",
        favicon: "store_favicon_url",
        footer: "footer_image_url",
        hero: "hero_image_url",
      }[kind];
      setSettings((s) => ({ ...s, [field]: data.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(null);
    }
  }

  async function handleGeocode() {
    if (!settings.origin_address) return;
    setGeocoding(true);
    setError(null);
    try {
      const { lat, lng } = await adminApi<{ lat: number; lng: number }>("geocodeAddress", {
        address: settings.origin_address,
      });
      setSettings((s) => ({ ...s, origin_lat: lat, origin_lng: lng }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível localizar o endereço.");
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await adminApi("saveSettings", { fields: settings });
      setMessage("Configurações salvas! A navbar e o rodapé já foram atualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Configurações da loja</h1>
      <p className="mb-6 text-sm text-slate-500">
        Troque o nome e a logo da loja sempre que precisar — eles aparecem automaticamente na navbar e
        no rodapé do site.
      </p>

      <div className="card space-y-6 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Nome da loja
            <HelpTip text="Nome exibido na navbar, no rodapé, no título da aba do navegador e nos e-mails enviados pra clientes." />
          </label>
          <input
            className="input"
            value={settings.store_name}
            onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Texto da barra de avisos (topo do site)
            <HelpTip text="Frase fixa exibida na faixa bem no topo de todas as páginas do site, acima da navbar." />
          </label>
          <input
            className="input"
            placeholder="Ex: Frete grátis acima de R$ 150"
            value={settings.announcement_text ?? ""}
            onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value || null })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Imagem do banner (topo da home)
            <HelpTip text="Imagem exibida em tela cheia no banner do topo da página inicial, em fundo preto. Substitui o título/subtítulo/botão de texto que tinha antes." />
          </label>
          {settings.hero_image_url && (
            <div className="relative mb-2 h-24 w-full max-w-md overflow-hidden rounded border bg-black">
              <Image src={settings.hero_image_url} alt="Banner da home" fill className="object-contain" />
            </div>
          )}
          <FileInput
            onFileSelected={(file) => handleUpload(file, "hero")}
            disabled={uploading === "hero"}
            label="Escolher imagem do banner"
          />
            {settings.hero_image_url && (
              <button
                type="button"
                className="mt-1 text-xs text-red-600 hover:underline"
                onClick={() => setSettings((s) => ({ ...s, hero_image_url: null }))}
              >
                Remover imagem
              </button>
            )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Logo
              <HelpTip text="Aparece na navbar (topo do site) ao lado do nome da loja, e no rodapé se não tiver uma imagem própria de rodapé configurada." />
            </label>
            {settings.store_logo_url && (
              <div className="relative mb-2 h-16 w-16 overflow-hidden rounded border">
                <Image src={settings.store_logo_url} alt="Logo" fill className="object-cover" />
              </div>
            )}
            <FileInput
              onFileSelected={(file) => handleUpload(file, "logo")}
              disabled={uploading === "logo"}
              label="Escolher logo"
            />
            {settings.store_logo_url && (
              <button
                type="button"
                className="mt-1 text-xs text-red-600 hover:underline"
                onClick={() => setSettings((s) => ({ ...s, store_logo_url: null }))}
              >
                Remover imagem
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Favicon
              <HelpTip text="Iconezinho que aparece na aba do navegador, ao lado do título da página." />
            </label>
            {settings.store_favicon_url && (
              <div className="relative mb-2 h-8 w-8 overflow-hidden rounded border">
                <Image src={settings.store_favicon_url} alt="Favicon" fill className="object-cover" />
              </div>
            )}
            <FileInput
              onFileSelected={(file) => handleUpload(file, "favicon")}
              disabled={uploading === "favicon"}
              label="Escolher favicon"
            />
            {settings.store_favicon_url && (
              <button
                type="button"
                className="mt-1 text-xs text-red-600 hover:underline"
                onClick={() => setSettings((s) => ({ ...s, store_favicon_url: null }))}
              >
                Remover imagem
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Imagem do rodapé
              <HelpTip text="Imagem exibida no rodapé do site, ao lado do nome da loja. Se deixar em branco, o rodapé usa a mesma logo da navbar." />
            </label>
            <p className="mb-1 text-xs text-slate-500">Opcional — se não colocar, o rodapé usa a mesma logo acima.</p>
            {settings.footer_image_url && (
              <div className="relative mb-2 h-16 w-16 overflow-hidden rounded border">
                <Image src={settings.footer_image_url} alt="Imagem do rodapé" fill className="object-cover" />
              </div>
            )}
            <FileInput
              onFileSelected={(file) => handleUpload(file, "footer")}
              disabled={uploading === "footer"}
              label="Escolher imagem do rodapé"
            />
            {settings.footer_image_url && (
              <button
                type="button"
                className="mt-1 text-xs text-red-600 hover:underline"
                onClick={() => setSettings((s) => ({ ...s, footer_image_url: null }))}
              >
                Remover imagem
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              WhatsApp
              <HelpTip text="Número usado no botão de WhatsApp do rodapé e nas redes sociais. Coloque com DDD (ex: 11999998888)." />
            </label>
            <input
              className="input"
              value={settings.contact_whatsapp ?? ""}
              onChange={(e) => setSettings({ ...settings, contact_whatsapp: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              E-mail de contato
              <HelpTip text="E-mail de contato exibido pro cliente (rodapé/redes sociais). Não é o e-mail de login do admin." />
            </label>
            <input
              className="input"
              value={settings.contact_email ?? ""}
              onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Instagram
              <HelpTip text="Seu @ do Instagram (com ou sem @). Vira um link clicável no rodapé do site." />
            </label>
            <input
              className="input"
              value={settings.contact_instagram ?? ""}
              onChange={(e) => setSettings({ ...settings, contact_instagram: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Endereço de origem da loja
            <HelpTip text="Endereço físico da loja. Usado pra calcular a distância até cada região de entrega e verificar se está chovendo (o que aumenta o frete estimado). Clique em 'Localizar' pra converter o endereço em coordenadas." />
          </label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Rua, número, bairro, cidade - UF"
              value={settings.origin_address ?? ""}
              onChange={(e) => setSettings({ ...settings, origin_address: e.target.value })}
            />
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={handleGeocode} disabled={geocoding}>
              {geocoding ? "Buscando..." : "Localizar"}
            </button>
          </div>
          {settings.origin_lat != null && (
            <p className="mt-1 text-xs text-slate-500">
              Coordenadas: {settings.origin_lat.toFixed(5)}, {settings.origin_lng?.toFixed(5)}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Taxa de serviço (%)
              <HelpTip text="Percentual cobrado em cima do subtotal do carrinho, como receita da plataforma (parecido com a taxa de serviço de apps de delivery). Cobrado junto com o produto no site." />
            </label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.1"
              value={settings.service_fee_percent}
              onChange={(e) => setSettings({ ...settings, service_fee_percent: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Taxa de serviço fixa (R$)
              <HelpTip text="Valor fixo somado à taxa de serviço em todo pedido, além do percentual acima. Pode deixar 0 se não quiser cobrar valor fixo." />
            </label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={settings.service_fee_fixed / 100}
              onChange={(e) =>
                setSettings({ ...settings, service_fee_fixed: Math.round(Number(e.target.value) * 100) })
              }
            />
          </div>
        </div>

        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
