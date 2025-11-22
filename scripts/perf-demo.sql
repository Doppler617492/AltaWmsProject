-- Seed minimal performance demo data (Receiving + Shipping) with 3 demo workers
-- Safe to run multiple times; uses upserts where possible

-- Some generic inventory movements so counts aren’t zero
INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by)
VALUES (1, NULL, NULL, 5, 'PUTAWAY', 0, 1)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by)
VALUES (2, NULL, NULL, 3, 'REPLENISHMENT', 0, 1)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by)
VALUES (3, NULL, NULL, 1, 'PALLET_FULL', 0, 1)
ON CONFLICT DO NOTHING;

DO $$
DECLARE v_supp int; v_item1 int; v_item2 int; v_rec int; v_rec2 int; v_rec3 int; v_ord int; v_ord2 int; v_ord3 int; v_user int; v_user2 int; v_user3 int;
BEGIN
  SELECT id INTO v_supp FROM suppliers LIMIT 1;
  IF v_supp IS NULL THEN
    INSERT INTO suppliers(name, country, address) VALUES ('TV Demo Supplier','RS','Beograd') RETURNING id INTO v_supp;
  END IF;

  -- Demo users (magacioneri only)
  SELECT id INTO v_user FROM users WHERE username='tv_demo';
  IF v_user IS NULL THEN
    INSERT INTO users(username,name,full_name,role,shift,email,is_active,active,password_hash)
      VALUES ('tv_demo','TV Demo','TV Demo','magacioner','PRVA','tv.demo@example.com',true,true,NULL)
      RETURNING id INTO v_user;
  END IF;

  SELECT id INTO v_user2 FROM users WHERE username='tv_demo2';
  IF v_user2 IS NULL THEN
    INSERT INTO users(username,name,full_name,role,shift,email,is_active,active,password_hash)
      VALUES ('tv_demo2','TV Demo 2','TV Demo 2','magacioner','DRUGA','tv.demo2@example.com',true,true,NULL)
      RETURNING id INTO v_user2;
  END IF;

  SELECT id INTO v_user3 FROM users WHERE username='tv_demo3';
  IF v_user3 IS NULL THEN
    INSERT INTO users(username,name,full_name,role,shift,email,is_active,active,password_hash)
      VALUES ('tv_demo3','TV Demo 3','TV Demo 3','magacioner','PRVA','tv.demo3@example.com',true,true,NULL)
      RETURNING id INTO v_user3;
  END IF;

  -- Demo items
  INSERT INTO items(sku,name,supplier_id,barcode) VALUES ('TV-DEMO-1','Demo artikl 1',v_supp,'TV1')
  ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name RETURNING id INTO v_item1;

  INSERT INTO items(sku,name,supplier_id,barcode) VALUES ('TV-DEMO-2','Demo artikl 2',v_supp,'TV2')
  ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name RETURNING id INTO v_item2;

  -- Receiving documents (3 variants: in_progress, in_progress, completed)
  INSERT INTO receiving_documents(document_number,supplier_id,pantheon_invoice_number,status,assigned_to,notes,received_by,created_at,started_at,completed_at)
    VALUES ('TV-PR-1001', v_supp, 'INV-TV-1','in_progress',v_user,'TV demo',v_user, NOW(), NOW(), NULL)
  ON CONFLICT (document_number) DO UPDATE SET status='in_progress'
  RETURNING id INTO v_rec;

  INSERT INTO receiving_documents(document_number,supplier_id,pantheon_invoice_number,status,assigned_to,notes,received_by,created_at,started_at,completed_at)
    VALUES ('TV-PR-1002', v_supp, 'INV-TV-2','in_progress',v_user2,'TV demo',v_user2, NOW(), NOW(), NULL)
  ON CONFLICT (document_number) DO UPDATE SET status='in_progress'
  RETURNING id INTO v_rec2;

  INSERT INTO receiving_documents(document_number,supplier_id,pantheon_invoice_number,status,assigned_to,notes,received_by,created_at,started_at,completed_at)
    VALUES ('TV-PR-1003', v_supp, 'INV-TV-3','completed',v_user3,'TV demo',v_user3, NOW(), NOW(), NOW())
  ON CONFLICT (document_number) DO UPDATE SET status='completed'
  RETURNING id INTO v_rec3;

  -- Receiving items
  DELETE FROM receiving_items WHERE receiving_document_id = v_rec;
  INSERT INTO receiving_items(receiving_document_id,item_id,expected_quantity,received_quantity,quantity_uom,status,created_at,updated_at)
    VALUES (v_rec, v_item1, 20, 10, 'KOM','scanned', NOW(), NOW()),
           (v_rec, v_item2, 15, 5,  'KOM','scanned', NOW(), NOW());

  DELETE FROM receiving_items WHERE receiving_document_id = v_rec2;
  INSERT INTO receiving_items(receiving_document_id,item_id,expected_quantity,received_quantity,quantity_uom,status,created_at,updated_at)
    VALUES (v_rec2, v_item1, 10, 2, 'KOM','scanned', NOW(), NOW()),
           (v_rec2, v_item2, 8,  1, 'KOM','scanned', NOW(), NOW());

  DELETE FROM receiving_items WHERE receiving_document_id = v_rec3;
  INSERT INTO receiving_items(receiving_document_id,item_id,expected_quantity,received_quantity,quantity_uom,status,created_at,updated_at)
    VALUES (v_rec3, v_item1, 12, 12, 'KOM','scanned', NOW(), NOW()),
           (v_rec3, v_item2, 6,  6,  'KOM','scanned', NOW(), NOW());

  -- Shipping orders
  INSERT INTO shipping_orders(order_number, customer_name, status, "createdById", created_at)
    VALUES ('TV-OT-2001','Demo Kupac','PICKING',v_user,NOW())
    ON CONFLICT (order_number) DO UPDATE SET status='PICKING'
    RETURNING id INTO v_ord;

  INSERT INTO shipping_orders(order_number, customer_name, status, "createdById", created_at)
    VALUES ('TV-OT-2002','Demo Kupac 2','PICKING',v_user2,NOW())
    ON CONFLICT (order_number) DO UPDATE SET status='PICKING'
    RETURNING id INTO v_ord2;

  INSERT INTO shipping_orders(order_number, customer_name, status, "createdById", created_at)
    VALUES ('TV-OT-2003','Demo Kupac 3','LOADED',v_user3,NOW())
    ON CONFLICT (order_number) DO UPDATE SET status='LOADED'
    RETURNING id INTO v_ord3;

  -- Shipping lines
  DELETE FROM shipping_order_lines WHERE "orderId" = v_ord;
  INSERT INTO shipping_order_lines("orderId","itemId",requested_qty,picked_qty,uom,pick_from_location_code,status_per_line)
    VALUES (v_ord, v_item1, 30, 10, 'KOM','A1-01','PICKING'),
           (v_ord, v_item2, 25, 5,  'KOM','A1-02','PICKING');

  DELETE FROM shipping_order_lines WHERE "orderId" = v_ord2;
  INSERT INTO shipping_order_lines("orderId","itemId",requested_qty,picked_qty,uom,pick_from_location_code,status_per_line)
    VALUES (v_ord2, v_item1, 10, 3, 'KOM','B1-01','PICKING'),
           (v_ord2, v_item2, 5,  1, 'KOM','B1-02','PICKING');

  DELETE FROM shipping_order_lines WHERE "orderId" = v_ord3;
  INSERT INTO shipping_order_lines("orderId","itemId",requested_qty,picked_qty,uom,pick_from_location_code,status_per_line)
    VALUES (v_ord3, v_item1, 12, 12, 'KOM','C1-01','LOADED'),
           (v_ord3, v_item2, 6,  6,  'KOM','C1-02','LOADED');

  -- Task assignees for per-user metrics
  INSERT INTO task_assignees(task_type, task_id, user_id, status) VALUES ('RECEIVING', v_rec,  v_user,  'IN_PROGRESS') ON CONFLICT DO NOTHING;
  INSERT INTO task_assignees(task_type, task_id, user_id, status) VALUES ('SHIPPING',  v_ord,  v_user,  'PICKING')     ON CONFLICT DO NOTHING;
  INSERT INTO task_assignees(task_type, task_id, user_id, status) VALUES ('RECEIVING', v_rec2, v_user2, 'IN_PROGRESS') ON CONFLICT DO NOTHING;
  INSERT INTO task_assignees(task_type, task_id, user_id, status) VALUES ('SHIPPING',  v_ord2, v_user2, 'PICKING')     ON CONFLICT DO NOTHING;
  INSERT INTO task_assignees(task_type, task_id, user_id, status) VALUES ('RECEIVING', v_rec3, v_user3, 'DONE')        ON CONFLICT DO NOTHING;
  INSERT INTO task_assignees(task_type, task_id, user_id, status) VALUES ('SHIPPING',  v_ord3, v_user3, 'DONE')        ON CONFLICT DO NOTHING;
END$$;
