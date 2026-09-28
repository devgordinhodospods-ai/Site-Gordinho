"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { adminApi } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { FileInput } from "@/components/ui/FileInput";
import type { SiteSettings } from "@/lib/types";

export function SettingsManager() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
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

  async function handleUpload(file: File, kind: "logo" | "favicon") {
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
      setSettings((s) => ({
        ...s,
        [kind === "logo" ? "store_logo_url" : "store_favicon_url"]: data.publicUrl,
      }));
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
          <label className="mb-1 block text-sm font-medium">Nome da loja</label>
          <input
            className="input"
            value={settings.store_name}
            onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Texto da barra de avisos (topo do site)</label>
          <input
            className="input"
            placeholder="Ex: Frete grátis acima de R$ 150"
            value={settings.announcement_text ?? ""}
            onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value || null })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Título de destaque (banner da home)</label>
            <input
              className="input"
              placeholder={settings.store_name}
              value={settings.hero_title ?? ""}
              onChange={(e) => setSettings({ ...settings, hero_title: e.target.value || null })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Subtítulo (banner da home)</label>
            <input
              className="input"
              placeholder="Confira nossos produtos e faça seu pedido com entrega rápida."
              value={settings.hero_subtitle ?? ""}
              onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value || null })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Logo</label>
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
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Favicon</label>
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
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">WhatsApp</label>
            <input
              className="input"
              value={settings.contact_whatsapp ?? ""}
              onChange={(e) => setSettings({ ...settings, contact_whatsapp: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">E-mail de contato</label>
            <input
              className="input"
              value={settings.contact_email ?? ""}
              onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Instagram</label>
            <input
              className="input"
              value={settings.contact_instagram ?? ""}
              onChange={(e) => setSettings({ ...settings, contact_instagram: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Endereço de origem da loja (usado para calcular frete e clima)
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
            <label className="mb-1 block text-sm font-medium">Taxa de serviço (%)</label>
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
            <label className="mb-1 block text-sm font-medium">Taxa de serviço fixa (R$)</label>
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
