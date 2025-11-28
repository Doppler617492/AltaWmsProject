-- Fix Bijelo Polje store name to match Cungu API exactly
-- Change from "Prodavnica Bijelo Polje" to "Prodavnica - Bijelo Polje"
UPDATE stores 
SET name = 'Prodavnica - Bijelo Polje' 
WHERE name = 'Prodavnica Bijelo Polje';

-- Verify the change
SELECT id, name, code FROM stores WHERE is_active = true ORDER BY name;
