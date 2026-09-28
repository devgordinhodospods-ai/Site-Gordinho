"use client";

import { useState } from "react";
import { Loader } from "@/components/ui/Loader";

export type AddressFormValues = {
  label: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
};

const EMPTY_ADDRESS: AddressFormValues = {
  label: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip: "",
  isDefault: false,
};

export function AddressForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Salvar endereço",
  showDefaultOption = true,
}: {
  initial?: Partial<AddressFormValues>;
  onSubmit: (values: AddressFormValues) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  showDefaultOption?: boolean;
}) {
  const [values, setValues] = useState<AddressFormValues>({ ...EMPTY_ADDRESS, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar endereço.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        className="input"
        placeholder="Apelido do endereço (ex: Casa, Trabalho)"
        value={values.label}
        onChange={(e) => setValues({ ...values, label: e.target.value })}
      />
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Rua"
          required
          value={values.street}
          onChange={(e) => setValues({ ...values, street: e.target.value })}
        />
        <input
          className="input w-24"
          placeholder="Número"
          required
          value={values.number}
          onChange={(e) => setValues({ ...values, number: e.target.value })}
        />
      </div>
      <input
        className="input"
        placeholder="Complemento (opcional)"
        value={values.complement}
        onChange={(e) => setValues({ ...values, complement: e.target.value })}
      />
      <input
        className="input"
        placeholder="Bairro"
        required
        value={values.neighborhood}
        onChange={(e) => setValues({ ...values, neighborhood: e.target.value })}
      />
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Cidade"
          required
          value={values.city}
          onChange={(e) => setValues({ ...values, city: e.target.value })}
        />
        <input
          className="input w-20"
          placeholder="UF"
          required
          maxLength={2}
          value={values.state}
          onChange={(e) => setValues({ ...values, state: e.target.value.toUpperCase() })}
        />
      </div>
      <input
        className="input"
        placeholder="CEP"
        required
        value={values.zip}
        onChange={(e) => setValues({ ...values, zip: e.target.value })}
      />

      {showDefaultOption && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={values.isDefault}
            onChange={(e) => setValues({ ...values, isDefault: e.target.checked })}
          />
          Usar como endereço padrão
        </label>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={saving}>
          {saving ? <Loader size={18} color="#fff" /> : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
