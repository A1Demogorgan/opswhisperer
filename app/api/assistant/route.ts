import { NextResponse } from "next/server";
import { assistantAnswer } from "@/lib/assistant";
import { getDashboard } from "@/lib/dashboard";

export async function POST(req: Request) {
  const body = (await req.json()) as { question: string; query?: string };
  const params = new URLSearchParams(body.query ?? "");
  const query: Record<string, string> = {};
  params.forEach((v, k) => {
    query[k] = v;
  });
  const { model } = getDashboard(query);
  return NextResponse.json(assistantAnswer(body.question ?? "", model));
}
