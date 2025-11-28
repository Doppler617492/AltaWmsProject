-- Fix store names to match Cungu API exactly
-- This migration corrects the store name mismatches that prevent stock sync

-- Fix Herceg Novi - change from "Prodavnica - Herceg Novi" to "Prodavnica - H.Novi (Meljine)"
UPDATE stores 
SET name = 'Prodavnica - H.Novi (Meljine)' 
WHERE name = 'Prodavnica - Herceg Novi';

-- Fix Ulcinj - change from "Prodavnica - Ulcinj Centar" to "Prodavnica - Ulcinj centar" (lowercase c)
UPDATE stores 
SET name = 'Prodavnica - Ulcinj centar' 
WHERE name = 'Prodavnica - Ulcinj Centar';

-- Verify the changes
SELECT id, name, code FROM stores WHERE is_active = true ORDER BY name;
