# COO Ops Data Definition

## Scope
This document defines the CSV datasets used by the COO Ops dashboard and chatbot.

Quarter in current synthetic pack:
- `2026Q1`

Primary dimensions used across datasets:
- `quarter_id`
- `sector`
- `service_line`
- `account`

## Table: targets_2026Q1_900M.csv
Purpose:
- Quarterly budget/target revenue input by account.

Grain:
- One row per `quarter_id + sector + service_line + account`.

Columns:
- `quarter_id`: Quarter key in `YYYYQ#` format (example `2026Q1`).
- `sector`: Sector label.
- `service_line`: Service line label.
- `account`: Account name.
- `revenue_target_usd`: Budget revenue target in USD for the quarter.

## Table: sow_plan_orders.csv
Purpose:
- Planned sold order movement in people by quarter horizon.

Grain:
- One row per order (`order_id`).

Columns:
- `order_id`: Unique order identifier.
- `sector`: Sector label.
- `service_line`: Service line label.
- `account`: Account name.
- `sow_type`: Type of SOW (e.g., Existing Project, Incremental, Net New).
- `total_people_planned`: Total people planned across horizon.
- `people_this_quarter`: Net people impact in current quarter.
- `people_next_quarter`: Net people impact in next quarter.
- `people_q_plus_2`: Net people impact in quarter +2.
- `people_q_plus_3`: Net people impact in quarter +3.

## Table: daily_forecast_ramp_2026Q1.csv
Purpose:
- Daily forecasted ramp-up and ramp-down people for the quarter.

Grain:
- One row per `quarter_id + date + sector + service_line + account`.

Columns:
- `quarter_id`
- `date`: Daily date (`YYYY-MM-DD`).
- `sector`
- `service_line`
- `account`
- `forecast_ramp_up_people`: Forecasted daily ramp-up people.
- `forecast_ramp_down_people`: Forecasted daily ramp-down people.

## Table: daily_actual_ramp_2026Q1.csv
Purpose:
- Daily actual ramp-up and ramp-down people; used for QTD actuals.

Grain:
- One row per `quarter_id + date + sector + service_line + account`.

Columns:
- `quarter_id`
- `date`: Daily date (`YYYY-MM-DD`).
- `sector`
- `service_line`
- `account`
- `actual_ramp_up_people`: Actual daily ramp-up people.
- `actual_ramp_down_people`: Actual daily ramp-down people.

## Table: historical_quarterly_last8q.csv
Purpose:
- Last 8 quarters history for trend charts and baseline.

Grain:
- One row per `quarter_id + sector + service_line + account`.

Columns:
- `quarter_id`
- `sector`
- `service_line`
- `account`
- `people_start_of_quarter`: People count at quarter start.
- `people_end_of_quarter`: People count at quarter end.
- `quarterly_revenue_usd`: Total realized revenue in quarter.

## Table: demand_weekly_positions.csv
Purpose:
- Weekly open/fulfilled position tracking for demand pipeline.

Grain:
- One row per `demand_id + week_number`.

Columns:
- `demand_id`: Unique demand identifier.
- `order_id`: Linked order identifier.
- `sector`
- `service_line`
- `account`
- `skill`: Skill requested.
- `role_level`: Role level.
- `city`: Location.
- `positions_required`: Total positions required for demand.
- `week_number`: Week number within tracking horizon.
- `positions_fulfilled_cum`: Cumulative positions fulfilled by that week.
- `positions_remaining`: Positions still open by that week.

## Table: demand_fulfillment.csv
Purpose:
- Fulfillment lifecycle and cycle times per demand.

Grain:
- One row per `demand_id`.

Columns:
- `demand_id`
- `order_id`
- `sector`
- `service_line`
- `account`
- `skillset`
- `volume_of_demand`: Demand volume size.
- `fulfillment_source`: Source of fulfillment (e.g., Internal, External).
- `fulfillment_type`: Fulfillment status/type (e.g., Customer_Billed).
- `demand_start_date`: Demand created/start date.
- `allocated_date`: Date demand was allocated.
- `billed_date`: Date demand was billed.
- `time_to_allocate_days`: Days from start to allocation.
- `time_to_bill_days`: Days from start to billing.

## Metric Derivation (Dashboard Logic)
Constants:
- Blended rate per hour: `$50`
- Hours per month: `160`
- Revenue per BPM per month: `$8,000`
- Revenue per resource per quarter: `$24,000` (`$8,000 * 3`)

Revenue:
- Budget Revenue: Sum of `targets_2026Q1_900M.revenue_target_usd`.
- Sold Revenue: `sold_resources * $24,000`.
- Forecast Revenue: `forecast_resources * $24,000`.
- Actual Revenue (QTD): `actual_resource_days * ($8,000 / 30)` for rows up to today.

BPM:
- BPM values are revenue converted using `$8,000` per BPM.

Net BPM / RU BPM / RD BPM:
- Previous quarter end baseline comes from `historical_quarterly_last8q`.
- RU and RD are built from ramp-up/ramp-down and order movements.
- Net BPM = `RU BPM - RD BPM`.
- Target Net BPM is constrained to be positive growth.

Timeline:
- Forecast lines run through quarter end.
- Actual lines run to current date (QTD).
- Projected actuals to quarter end are shown as dotted continuation.

## Data Join/Filter Guidance
Common filter keys:
- `sector`
- `service_line`
- `account`

Quarter mapping:
- Runtime quarter format may appear as `2026-Q1` in app logic and `2026Q1` in CSVs.

Demand notes:
- Open demand is tracked in `demand_weekly_positions`.
- Fulfilled demand and cycle time analysis come from `demand_fulfillment`.
