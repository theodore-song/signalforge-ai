import Dashboard from "@/components/Dashboard";
import { runScan } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialScan = await runScan(false);
  return <Dashboard initialScan={initialScan} />;
}
