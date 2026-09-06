import type { ScanResult } from "./types";

const KEY = "signalforge:latest-scan";

export async function saveScan(scan: ScanResult) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  const response = await fetch(`${url}/set/${encodeURIComponent(KEY)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(scan)
  });
  return response.ok;
}
