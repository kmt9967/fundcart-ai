export function bundleTotal(prices: Array<number | null | undefined>, budgetCents: number | null) {
  const priced = prices.filter((price): price is number => price != null && Number.isSafeInteger(price) && price >= 0);
  const totalCents = priced.reduce((total, price) => total + price, 0);
  return { totalCents, unquoted: prices.length - priced.length, overBudget: budgetCents != null && totalCents > budgetCents };
}

export function componentSocket(attributes: Record<string, string[]>): string | null {
  const values = Object.entries(attributes).filter(([key]) => /^(cpu[ _-])?socket(_type)?$/i.test(key)).flatMap(([, values]) => values)
    .map(value => value.trim().toUpperCase()).filter(value => /^(AM[45]|LGA\d{3,4}|TR4|STRX4)$/.test(value));
  const distinct = [...new Set(values)];
  return distinct.length === 1 ? distinct[0] : null;
}

export function componentMemoryGeneration(attributes: Record<string, string[]>): string | null {
  const values = Object.entries(attributes)
    .filter(([key]) => /^(supported[ _-])?(ram|memory)[ _-](type|generation)$/i.test(key))
    .flatMap(([, entries]) => entries.map(value => value.trim().toUpperCase()));
  const distinct = [...new Set(values)];
  return distinct.length === 1 && /^DDR[345]$/.test(distinct[0]) ? distinct[0] : null;
}

export function componentMatch(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return 'unknown';
  return left === right ? 'compatible' : 'incompatible';
}
