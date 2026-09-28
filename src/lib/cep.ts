export type CepLookup = { street: string; city: string; neighborhood: string; state: string };

/**
 * Consulta o ViaCEP (API pública e gratuita, sem chave) pra preencher o
 * endereço a partir do CEP.
 */
export async function lookupCep(cep: string): Promise<CepLookup | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;
    return {
      street: data.logradouro ?? "",
      city: data.localidade ?? "",
      neighborhood: data.bairro ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
