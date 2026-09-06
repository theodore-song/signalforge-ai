export default function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 104;
    const y = 34 - ((value - min) / Math.max(max - min, 0.01)) * 30;
    return `${x},${y}`;
  }).join(" ");
  return <svg className="sparkline" viewBox="0 0 104 38" role="img" aria-label={`${positive ? "Positive" : "Negative"} price trend`}><polyline points={points} className={positive ? "spark-positive" : "spark-negative"}/></svg>;
}
