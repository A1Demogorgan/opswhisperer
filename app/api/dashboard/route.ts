import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/dashboard";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });
  const { model } = getDashboard(query);
  return NextResponse.json(model);
}
