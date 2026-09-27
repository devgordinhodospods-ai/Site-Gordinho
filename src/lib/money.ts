export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function brlToCents(value: number): number {
  return Math.round(value * 100);
}
