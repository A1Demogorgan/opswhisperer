import { config } from "@/config";
import { addDays, quarterStartEnd, toISODate } from "@/lib/date";
import type {
  Account,
  BillingEvent,
  Demand,
  ExistingRun,
  FulfillmentEvent,
  Opportunity,
  OrderBooking,
  QuarterKey,
  Sector,
  ServiceLine,
  SOW,
} from "@/lib/models";
import { seeded } from "@/lib/random";

export interface Dataset {
  sectors: Sector[];
  serviceLines: ServiceLine[];
  accounts: Account[];
  opportunities: Opportunity[];
  bookings: OrderBooking[];
  sows: SOW[];
  demands: Demand[];
  fulfillmentEvents: FulfillmentEvent[];
  billingEvents: BillingEvent[];
  existingRuns: ExistingRun[];
  refreshDate: string;
}

const skills = [
  "Java",
  "Data Engineering",
  "SRE",
  "Cloud Architect",
  "Cyber SOC",
  "QA Automation",
  "Business Analyst",
  "Full Stack",
  "PMO",
];
const cities = ["New York", "Dallas", "Toronto", "Bangalore", "London", "Austin"];
const levels = ["L1", "L2", "L3", "L4", "L5"];

export function generateDataset(quarter: QuarterKey, todayISO: string): Dataset {
  const { start, end } = quarterStartEnd(quarter);
  const rand = seeded(hash(quarter));
  const sectors: Sector[] = config.sectors.map((name, i) => ({ id: `sec-${i + 1}`, name }));
  const serviceLines: ServiceLine[] = config.serviceLines.map((name, i) => ({
    id: `sl-${i + 1}`,
    name,
  }));

  const accounts: Account[] = Array.from({ length: 40 }, (_, i) => {
    const sector = sectors[i % sectors.length];
    const sl = serviceLines[(i + rand.int(0, 4)) % serviceLines.length];
    return {
      id: `acc-${String(i + 1).padStart(3, "0")}`,
      name: `Account ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
      sectorId: sector.id,
      primaryServiceLineId: sl.id,
      sdluId: `${sl.id}-dlu-${(i % 3) + 1}`,
    };
  });

  const sows: SOW[] = [];
  const bookings: OrderBooking[] = [];
  const demands: Demand[] = [];
  const fulfillmentEvents: FulfillmentEvent[] = [];
  const billingEvents: BillingEvent[] = [];
  const opportunities: Opportunity[] = [];
  const existingRuns: ExistingRun[] = [];

  let demandCounter = 1;
  for (let i = 0; i < 180; i++) {
    const account = rand.pick(accounts);
    const serviceLine = serviceLines.find((x) => x.id === account.primaryServiceLineId) ?? rand.pick(serviceLines);
    const sowId = `sow-${String(i + 1).padStart(3, "0")}`;
    const sowStart = addDays(start, rand.int(0, 55));
    const sowEnd = addDays(sowStart, rand.int(30, 90));
    sows.push({
      id: sowId,
      accountId: account.id,
      type: rand.next() > 0.62 ? "Incremental" : "New",
      serviceLineId: serviceLine.id,
      startDate: toISODate(sowStart),
      endDate: toISODate(sowEnd > end ? end : sowEnd),
    });

    const soldRevenueUsd = rand.int(2800000, 6800000);
    const sourceBucket = rand.next();
    const source =
      sourceBucket < 0.4
        ? "RunRate"
        : sourceBucket < 0.7
          ? "IncrementalSOW"
          : sourceBucket < 0.9
            ? "NewProject"
            : "NewOrder";

    bookings.push({
      id: `book-${String(i + 1).padStart(3, "0")}`,
      accountId: account.id,
      sectorId: account.sectorId,
      serviceLineId: serviceLine.id,
      quarter,
      bookedDate: toISODate(addDays(start, rand.int(0, 70))),
      soldRevenueUsd,
      source,
    });

    if (rand.next() > 0.18) {
      const demandCount = rand.int(1, 3);
      for (let d = 0; d < demandCount; d++) {
        const demandId = `dem-${String(demandCounter++).padStart(4, "0")}`;
        const demandStart = addDays(start, rand.int(0, 70));
        const demandEnd = addDays(demandStart, rand.int(20, 75));
        const demand: Demand = {
          demandId,
          accountId: account.id,
          sectorId: account.sectorId,
          serviceLineId: serviceLine.id,
          sdluId: account.sdluId,
          skill: rand.pick(skills),
          roleLevel: rand.pick(levels),
          quantity: rand.int(1, 6),
          city: rand.pick(cities),
          sowId,
          demandStartDate: toISODate(demandStart),
          demandEndDate: toISODate(demandEnd > end ? end : demandEnd),
          createdDate: toISODate(addDays(demandStart, -rand.int(4, 16))),
          demandSource: rand.next() > 0.22 ? "Booked" : "AtRisk",
        };
        demands.push(demand);

        const reserveChance = rand.next();
        const reservedDate = reserveChance > 0.1 ? toISODate(addDays(demandStart, rand.int(-2, 8))) : undefined;
        const allocatedDate = reserveChance > 0.22 ? toISODate(addDays(demandStart, rand.int(0, 14))) : undefined;
        fulfillmentEvents.push({ demandId, reservedDate, allocatedDate });

        if (allocatedDate && rand.next() > 0.2) {
          const billableStartDate = toISODate(addDays(new Date(allocatedDate), rand.int(0, 12)));
          const billableEndDate = toISODate(addDays(new Date(billableStartDate), rand.int(12, 75)));
          billingEvents.push({
            demandId,
            billableStartDate,
            billableEndDate: billableEndDate > toISODate(end) ? toISODate(end) : billableEndDate,
          });
        }
      }
    }

    if (rand.next() > 0.55) {
      opportunities.push({
        id: `opp-${String(i + 1).padStart(3, "0")}`,
        accountId: account.id,
        sectorId: account.sectorId,
        serviceLineId: serviceLine.id,
        quarter,
        valueUsd: rand.int(1800000, 12000000),
        atRisk: rand.next() > 0.45,
        createdDate: toISODate(addDays(start, rand.int(0, 65))),
      });
    }
  }

  for (let i = 0; i < 90; i++) {
    const account = rand.pick(accounts);
    const serviceLine = serviceLines.find((x) => x.id === account.primaryServiceLineId) ?? rand.pick(serviceLines);
    existingRuns.push({
      id: `run-${String(i + 1).padStart(3, "0")}`,
      accountId: account.id,
      sectorId: account.sectorId,
      serviceLineId: serviceLine.id,
      quantity: rand.int(1, 6),
      billingEndDate: toISODate(addDays(start, rand.int(2, 88))),
    });
  }

  return {
    sectors,
    serviceLines,
    accounts,
    opportunities,
    bookings,
    sows,
    demands,
    fulfillmentEvents,
    billingEvents,
    existingRuns,
    refreshDate: todayISO,
  };
}

function hash(v: string): number {
  let h = 2166136261;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
