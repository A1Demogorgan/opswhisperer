export type QuarterKey = `${number}-Q${1 | 2 | 3 | 4}`;

export type DemandSource = "Booked" | "AtRisk";
export type OwnerType =
  | "Sales lead"
  | "Account lead"
  | "Staffing"
  | "Delivery"
  | "Finance ops";

export interface Sector {
  id: string;
  name: string;
}

export interface ServiceLine {
  id: string;
  name: string;
}

export interface Account {
  id: string;
  name: string;
  sectorId: string;
  primaryServiceLineId: string;
  sdluId: string;
}

export interface Opportunity {
  id: string;
  accountId: string;
  sectorId: string;
  serviceLineId: string;
  quarter: QuarterKey;
  valueUsd: number;
  atRisk: boolean;
  createdDate: string;
}

export interface OrderBooking {
  id: string;
  accountId: string;
  sectorId: string;
  serviceLineId: string;
  quarter: QuarterKey;
  bookedDate: string;
  soldRevenueUsd: number;
  source: "RunRate" | "IncrementalSOW" | "NewProject" | "NewOrder";
}

export interface SOW {
  id: string;
  accountId: string;
  type: "Incremental" | "New";
  serviceLineId: string;
  startDate: string;
  endDate: string;
}

export interface Demand {
  demandId: string;
  accountId: string;
  sectorId: string;
  serviceLineId: string;
  sdluId: string;
  skill: string;
  roleLevel: string;
  quantity: number;
  city: string;
  sowId: string;
  demandStartDate: string;
  demandEndDate: string;
  createdDate: string;
  demandSource: DemandSource;
}

export interface FulfillmentEvent {
  demandId: string;
  reservedDate?: string;
  allocatedDate?: string;
}

export interface BillingEvent {
  demandId: string;
  billableStartDate?: string;
  billableEndDate?: string;
}

export interface ExistingRun {
  id: string;
  accountId: string;
  sectorId: string;
  serviceLineId: string;
  quantity: number;
  billingEndDate: string;
}

export interface FilterState {
  quarter: QuarterKey;
  sectorId?: string;
  serviceLineId?: string;
  sdluId?: string;
  accountId?: string;
}

export interface KpiSet {
  targetRevenueUsd: number;
  soldRevenueUsd: number;
  qtdActualRevenueUsd: number;
  forecastRevenueUsd: number;
  gapToTargetUsd: number;
  gapToTargetPct: number;
  soldBpm: number;
  actualBpmNetQtd: number;
  forecastBpm: number;
  demandOpenBpm: number;
  fulfilledBpm: number;
  axnbCount: number;
  avgTtfDays: number;
  ttfBreachedPct: number;
  ruBpmQtd: number;
  rdBpmQtd: number;
}

export interface ActionRecommendation {
  id: string;
  title: string;
  rationale: string;
  impactedMetric: string;
  estimatedUpliftBpm: number;
  estimatedUpliftRevenueUsd: number;
  confidence: "Low" | "Medium" | "High";
  ownerType: OwnerType;
  deepLink: string;
  track: "revenue" | "bpm";
}

export interface AssistantResponse {
  intent: string;
  shortAnswer: string;
  explanation: string[];
  nextClicks: { label: string; href: string }[];
  recommendedActions: string[];
}
