function formatHours(hours: number): string {
  return hours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Totals = { clientId: string; clientName: string; hours: number }[];

export function TotalsByClientSummary({ totals }: { totals: Totals }) {
  if (totals.length === 0) return null;

  const grandTotal = totals.reduce((acc, t) => acc + t.hours, 0);

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Total de horas por cliente (filtro atual)</p>
      <div className="flex flex-wrap gap-2">
        {totals.map((t) => (
          <span key={t.clientId} className="rounded-full border bg-background px-3 py-1 text-xs">
            {t.clientName}: <span className="font-medium">{formatHours(t.hours)}h</span>
          </span>
        ))}
        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs">
          Total: <span className="font-medium">{formatHours(grandTotal)}h</span>
        </span>
      </div>
    </div>
  );
}
