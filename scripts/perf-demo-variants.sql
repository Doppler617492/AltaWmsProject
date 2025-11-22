-- Adjust demo percentages to show variety (~60%, ~10%, 100%)
DO $$
DECLARE v_item1 int; v_item2 int; v_rec1 int; v_rec2 int; v_rec3 int; v_ord1 int; v_ord2 int; v_ord3 int;
BEGIN
  SELECT id INTO v_item1 FROM items WHERE sku='TV-DEMO-1';
  SELECT id INTO v_item2 FROM items WHERE sku='TV-DEMO-2';
  SELECT id INTO v_rec1  FROM receiving_documents WHERE document_number='TV-PR-1001';
  SELECT id INTO v_rec2  FROM receiving_documents WHERE document_number='TV-PR-1002';
  SELECT id INTO v_rec3  FROM receiving_documents WHERE document_number='TV-PR-1003';
  SELECT id INTO v_ord1  FROM shipping_orders WHERE order_number='TV-OT-2001';
  SELECT id INTO v_ord2  FROM shipping_orders WHERE order_number='TV-OT-2002';
  SELECT id INTO v_ord3  FROM shipping_orders WHERE order_number='TV-OT-2003';

  -- Receiving: tv_demo (60%): item1 12/20, item2 9/15
  UPDATE receiving_items SET received_quantity=12 WHERE receiving_document_id=v_rec1 AND item_id=v_item1;
  UPDATE receiving_items SET received_quantity=9  WHERE receiving_document_id=v_rec1 AND item_id=v_item2;

  -- Receiving: tv_demo2 (~10%): item1 1/10, item2 1/8
  UPDATE receiving_items SET received_quantity=1 WHERE receiving_document_id=v_rec2 AND item_id=v_item1;
  UPDATE receiving_items SET received_quantity=1 WHERE receiving_document_id=v_rec2 AND item_id=v_item2;

  -- Shipping lines: tv_demo (60%): item1 18/30, item2 15/25
  UPDATE shipping_order_lines SET picked_qty='18' WHERE "orderId"=v_ord1 AND "itemId"=v_item1;
  UPDATE shipping_order_lines SET picked_qty='15' WHERE "orderId"=v_ord1 AND "itemId"=v_item2;

  -- Shipping lines: tv_demo2 (~10%): item1 1/10, item2 0/5
  UPDATE shipping_order_lines SET picked_qty='1'  WHERE "orderId"=v_ord2 AND "itemId"=v_item1;
  UPDATE shipping_order_lines SET picked_qty='0'  WHERE "orderId"=v_ord2 AND "itemId"=v_item2;
END$$;

