import { Suspense } from "react";
import { CockpitTopNav } from "@/components/CockpitTopNav";
import CockpitHomePage from "./(cockpit)/page";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Suspense fallback={null}>
        <CockpitTopNav />
      </Suspense>
      <CockpitHomePage searchParams={searchParams} />
    </div>
  );
}
