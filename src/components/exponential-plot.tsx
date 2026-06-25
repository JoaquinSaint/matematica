import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer } from "recharts";

export type ExpParams = { a: number; b: number; k: number };

export function exponentialFormulaText({ a, b, k }: ExpParams) {
  const aStr = a === 1 ? "" : a === -1 ? "−" : `${a} · `;
  const kStr = k === 0 ? "" : k > 0 ? ` + ${k}` : ` − ${Math.abs(k)}`;
  return `f(x) = ${aStr}${b}^x${kStr}`;
}

export function ExponentialPlot({ a, b, k, xMin = -3, xMax = 3, height = 260 }: ExpParams & { xMin?: number; xMax?: number; height?: number }) {
  const points: { x: number; y: number }[] = [];
  const step = (xMax - xMin) / 80;
  for (let x = xMin; x <= xMax + step / 2; x += step) {
    const y = a * Math.pow(b, x) + k;
    if (Number.isFinite(y) && Math.abs(y) < 1e6) points.push({ x: +x.toFixed(3), y: +y.toFixed(3) });
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[xMin, xMax]}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-mono)" }}
            stroke="var(--color-muted-foreground)"
          />
          <YAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-mono)" }}
            stroke="var(--color-muted-foreground)"
            width={40}
          />
          <ReferenceLine y={k} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
          <ReferenceLine x={0} stroke="var(--color-foreground)" strokeOpacity={0.4} />
          <Line type="monotone" dataKey="y" stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}