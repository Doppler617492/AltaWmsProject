-- Optional view for worker performance aggregation (safe to run multiple times)
CREATE OR REPLACE VIEW v_performance_worker AS
SELECT u.full_name AS name,
       COALESCE(u.role, 'Picking') AS team,
       0::bigint AS box_assigned,
       0::bigint AS box_completed,
       0::bigint AS items_assigned,
       0::bigint AS items_completed
FROM users u;

