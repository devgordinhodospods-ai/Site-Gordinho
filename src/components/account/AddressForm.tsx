"use client";

import { useState } from "react";
import { Loader } from "@/components/ui/Loader";
import { AddressFields, EMPTY_ADDRESS_VALUES, type AddressValues } from "@/components/account/AddressFields";

export type AddressFormValues = AddressValues & {
  label: string;
  isDefault: boolean;
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
  const [values, setValues] = useState<AddressFormValues>({
    ...EMPTY_ADDRESS_VALUES,
    label: "",
    isDefault: false,
    ...initial,
  });
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
      <AddressFields value={values} onChange={(address) => setValues({ ...values, ...address })} />

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

      {error && <p className="text-sm text-red-600">{error}</p>}

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
