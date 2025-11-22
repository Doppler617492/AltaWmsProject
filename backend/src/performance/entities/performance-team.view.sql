-- Optional view for team performance aggregation (safe to run multiple times)
CREATE OR REPLACE VIEW v_performance_team AS
SELECT 'CD'::text AS team,
       0::bigint AS box_assigned,
       0::bigint AS box_completed,
       0::bigint AS invoices_completed,
       0::bigint AS sku_completed,
       0::bigint AS putaway,
       0::bigint AS replenishment,
       0::bigint AS full_palets,
       0::bigint AS total_palets;
