/**
 * Runs `fn` over `items` with at most `limit` calls in flight, keeping results in input order.
 * For independent per-row work (bulk edits, fan-out to external APIs) that would otherwise run
 * one round trip at a time — bounded so it doesn't drain the DB pool or hammer a remote API.
 */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
