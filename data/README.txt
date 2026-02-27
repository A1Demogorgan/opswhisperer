COO Ops Synthetic Data Pack
Generated: 2026-02-27T02:31:50.800788
Current Quarter: 2026Q1 (2026-01-01 to 2026-03-31)

Files:
1) targets_2026Q1_900M.csv
2) daily_forecast_ramp_2026Q1.csv
3) daily_actual_ramp_2026Q1.csv
4) historical_quarterly_last8q.csv
5) sow_plan_orders.csv
6) demand_weekly_positions.csv
7) demand_fulfillment.csv

Notes:
- Total target for 2026Q1 is ~$900M, allocated with ~80/20 across accounts.
- Historical quarters are 2024Q1, 2024Q2, 2024Q3, 2024Q4, 2025Q1, 2025Q2, 2025Q3, 2025Q4 with per-quarter total revenue around ~$850M (small drift).
- Demand exists only for Incremental and Net New orders.
- Demand weekly table includes positions_fulfilled_cum and positions_remaining that always sum to positions_required.
- Fulfillment table includes demand_start_date, allocated_date, billed_date and time_to_allocate_days/time_to_bill_days.
