"use client";

import { useState } from "react";
import { Loader } from "@/components/ui/Loader";

export type AddressValues = {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
};

export const EMPTY_ADDRESS_VALUES: AddressValues = {
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip: "",
};

export function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/**
 * Campos de endereço controlados (sem <form> próprio, pra poder ficar dentro
 * de outro formulário). Ao completar o CEP, preenche rua/bairro/cidade/UF.
 */
export function AddressFields({
  value,
  onChange,
}: {
  value: AddressValues;
  onChange: (value: AddressValues) => void;
}) {
  const [lookingUp, setLookingUp] = useState(false);
  const [cepHint, setCepHint] = useState<string | null>(null);

  const set = (patch: Partial<AddressValues>) => onChange({ ...value, ...patch });

  async function handleCepChange(raw: string) {
    const zip = formatCep(raw);
    set({ zip });
    setCepHint(null);

    const digits = zip.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setLookingUp(true);
    try {
      const res = await fetch(`/api/cep/${digits}`);
      if (!res.ok) {
        setCepHint("Não achamos esse CEP — preencha o endereço manualmente.");
        return;
      }
      const { address } = await res.json();
      onChange({
        ...value,
        zip,
        street: address.street || value.street,
        neighborhood: address.neighborhood || value.neighborhood,
        city: address.city || value.city,
        state: address.state || value.state,
      });
    } catch {
      // sem conexão com o serviço de CEP: o cliente preenche na mão
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="relative sm:w-48">
          <input
            className="input"
            placeholder="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            required
            value={value.zip}
            onChange={(e) => handleCepChange(e.target.value)}
          />
          {lookingUp && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader size={16} />
            </span>
          )}
        </div>
        {cepHint && <p className="mt-1 text-xs text-amber-700">{cepHint}</p>}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Rua"
          autoComplete="address-line1"
          required
          value={value.street}
          onChange={(e) => set({ street: e.target.value })}
        />
        <input
          className="input w-24"
          placeholder="Número"
          required
          value={value.number}
          onChange={(e) => set({ number: e.target.value })}
        />
      </div>
      <input
        className="input"
        placeholder="Complemento (opcional)"
        autoComplete="address-line2"
        value={value.complement}
        onChange={(e) => set({ complement: e.target.value })}
      />
      <input
        className="input"
        placeholder="Bairro"
        required
        value={value.neighborhood}
        onChange={(e) => set({ neighborhood: e.target.value })}
      />
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Cidade"
          autoComplete="address-level2"
          required
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
        />
        <input
          className="input w-20"
          placeholder="UF"
          autoComplete="address-level1"
          required
          maxLength={2}
          value={value.state}
          onChange={(e) => set({ state: e.target.value.toUpperCase() })}
        />
      </div>
    </div>
  );
}
