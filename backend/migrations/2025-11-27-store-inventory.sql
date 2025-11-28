-- Store inventory cache table
-- Stores inventory fetched from Cungu API per store

CREATE TABLE IF NOT EXISTS store_inventory (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    item_ident VARCHAR(50) NOT NULL,
    item_name VARCHAR(255),
    quantity NUMERIC(10, 2) DEFAULT 0,
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, item_ident)
);

CREATE INDEX IF NOT EXISTS idx_store_inventory_store_id ON store_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_item_ident ON store_inventory(item_ident);
CREATE INDEX IF NOT EXISTS idx_store_inventory_last_synced ON store_inventory(last_synced_at);

COMMENT ON TABLE store_inventory IS 'Cached store inventory from Cungu API';
COMMENT ON COLUMN store_inventory.item_ident IS 'Item identifier from Cungu (barcode)';
COMMENT ON COLUMN store_inventory.quantity IS 'Stock quantity at this store';
COMMENT ON COLUMN store_inventory.last_synced_at IS 'When this record was last synced from Cungu API';
