import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/dashboard";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const url = new URL(req.url);
  const query: Record<string, string> = { accountId: resolved.id };
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });
  const { model } = getDashboard(query);
  const account = model.accountMetrics.find((a) => a.accountId === resolved.id);
  const demands = model.dataset.demands.filter((d) => d.accountId === resolved.id);
  return NextResponse.json({ account, demands });
}
