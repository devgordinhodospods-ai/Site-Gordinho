export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function brlToCents(value: number): number {
  return Math.round(value * 100);
}

export function computeServiceFee(params: { subtotalCents: number; percent: number; fixedCents: number }): number {
  const percentPart = Math.round((params.subtotalCents * params.percent) / 100);
  return percentPart + params.fixedCents;
}
