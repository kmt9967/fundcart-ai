export function bundleTotal(prices: Array<number | null | undefined>, budgetCents: number | null) {
  const priced = prices.filter((price): price is number => price != null && Number.isSafeInteger(price) && price >= 0);
  const totalCents = priced.reduce((total, price) => total + price, 0);
  return { totalCents, unquoted: prices.length - priced.length, overBudget: budgetCents != null && totalCents > budgetCents };
}
