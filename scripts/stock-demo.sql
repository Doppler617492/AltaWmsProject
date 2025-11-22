-- Demo inventory and movements for FAZA 5.1 smoke
-- Items and locations must already exist from seed

-- Insert some inventory balances (upsert style may vary by DB, keep simple inserts assuming unique constraint)
-- These may fail if rows already exist; that's ok for a demo script.
INSERT INTO inventory (item_id, location_id, quantity) SELECT 1, 1, 120.000 WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_id=1 AND location_id=1);
INSERT INTO inventory (item_id, location_id, quantity) SELECT 1, 2, 280.500 WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_id=1 AND location_id=2);
INSERT INTO inventory (item_id, location_id, quantity) SELECT 2, 1, 90.000 WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_id=2 AND location_id=1);

-- Movements (last 24h)
INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by, created_at)
VALUES (1, NULL, 1, 40.0, 'PRIJEM', 1, 2, NOW() - INTERVAL '3 hours');

INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by, created_at)
VALUES (1, 1, 2, 20.5, 'PREMEŠTAJ', 2, 2, NOW() - INTERVAL '2 hours');

INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by, created_at)
VALUES (2, NULL, 1, 15.0, 'PRIJEM', 2, 2, NOW() - INTERVAL '1 hours');

