export type CepLookup = {
  street: string;
  city: string;
  neighborhood: string;
  state: string;
  ibge: string;
  /** Coordenadas, quando o serviço que achou o CEP já informa. */
  lat?: number;
  lng?: number;
};

const TIMEOUT_MS = 6000;
// Guarda em memória os CEPs já achados (o servidor fica ligado no Railway):
// menos chamadas aos serviços gratuitos, que limitam/bloqueiam excesso.
const cache = new Map<string, { at: number; value: CepLookup }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "GordinhoDosPods/1.0 (+https://www.gordinhodospods.com.br)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

type Provider = { name: string; lookup: (digits: string) => Promise<CepLookup | null> };

// Vários serviços gratuitos, sem chave: se um cair, bloquear o servidor ou
// não conhecer o CEP, tenta o próximo.
const PROVIDERS: Provider[] = [
  {
    name: "ViaCEP",
    lookup: async (d) => {
      const data = (await getJson(`https://viacep.com.br/ws/${d}/json/`)) as Record<string, string> & { erro?: unknown };
      if (data?.erro || !data?.localidade) return null;
      return { street: data.logradouro ?? "", city: data.localidade, neighborhood: data.bairro ?? "", state: data.uf ?? "", ibge: data.ibge ?? "" };
    },
  },
  {
    name: "BrasilAPI",
    lookup: async (d) => {
      const data = (await getJson(`https://brasilapi.com.br/api/cep/v2/${d}`)) as {
        street?: string;
        city?: string;
        neighborhood?: string;
        state?: string;
        location?: { coordinates?: { latitude?: unknown; longitude?: unknown } };
      };
      if (!data?.city) return null;
      return {
        street: data.street ?? "",
        city: data.city,
        neighborhood: data.neighborhood ?? "",
        state: data.state ?? "",
        ibge: "",
        lat: num(data.location?.coordinates?.latitude),
        lng: num(data.location?.coordinates?.longitude),
      };
    },
  },
  {
    name: "AwesomeAPI",
    lookup: async (d) => {
      const data = (await getJson(`https://cep.awesomeapi.com.br/json/${d}`)) as Record<string, string>;
      if (!data?.city) return null;
      return {
        street: data.address_name || data.address || "",
        city: data.city,
        neighborhood: data.district ?? "",
        state: data.state ?? "",
        ibge: data.city_ibge ?? "",
        lat: num(data.lat),
        lng: num(data.lng),
      };
    },
  },
  {
    name: "OpenCEP",
    lookup: async (d) => {
      const data = (await getJson(`https://opencep.com/v1/${d}`)) as Record<string, string> & { error?: unknown };
      if (data?.error || !data?.localidade) return null;
      return { street: data.logradouro ?? "", city: data.localidade, neighborhood: data.bairro ?? "", state: data.uf ?? "", ibge: data.ibge ?? "" };
    },
  },
];

/**
 * Endereço (e, quando der, coordenadas) a partir do CEP, tentando vários
 * serviços públicos e gratuitos em sequência.
 */
export async function lookupCep(cep: string): Promise<CepLookup | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const hit = cache.get(digits);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let found: CepLookup | null = null;
  for (const provider of PROVIDERS) {
    try {
      const result = await provider.lookup(digits);
      if (!result) continue;
      const current: CepLookup = found ?? result;
      // Endereço do primeiro que achou; coordenadas do primeiro que tiver.
      found = current.lat == null && result.lat != null ? { ...current, lat: result.lat, lng: result.lng } : current;
      // Já tem endereço e coordenadas: não precisa perguntar a mais ninguém.
      if (found.lat != null && found.lng != null) break;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[cep] ${provider.name} falhou pro CEP ${digits}:`, err instanceof Error ? err.message : err);
    }
  }
  if (found) cache.set(digits, { at: Date.now(), value: found });
  return found;
}
