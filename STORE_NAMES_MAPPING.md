# Store Names Mapping - Cungu API vs Database

## Issue
Some stores are not receiving articles during stock sync because their names in the database don't exactly match the store names returned by Cungu API's `getStock` method. The matching is **EXACT** (case-sensitive).

## Cungu API Store Names (Objekat field from getStock)
These are the actual store names returned by Cungu API:

1. `Veleprodajni Magacin` - ✅ Matches
2. `Tranzitno skladiste` - (No warehouse, no matching in DB)
3. `Carinsko skladište` - (No warehouse, no matching in DB)
4. `Prodavnica - Ulcinj centar` - ⚠️ **CASE MISMATCH** (database has "Ulcinj Centar" with capital C)
5. `Prodavnica - Podgorica Centar` - ✅ Should match
6. `Prodavnica - H.Novi (Meljine)` - ⚠️ **NAME DIFFERENT** (database shows "Herceg Novi", Cungu shows "H.Novi (Meljine)")
7. `Prodavnica - Tivat` - ✅ Should match
8. `Prodavnica - Budva 2` - ✅ Should match
9. `Prodavnica - Kotor Centar` - ✅ Should match
10. `Salon profesional` - (Likely missing from database)
11. `Prodavnica - Bar` - ✅ Should match

## Issues Found

### 1. Bijelo Polje - NOT IN CUNGU API
- **Database**: `PRODAVNICA_BIJELO_POLJE`
- **Cungu API**: Not present in stock data
- **Action**: This store has no stock data from Cungu, so no items will appear

### 2. Herceg Novi - NAME MISMATCH
- **Database**: `Prodavnica - Herceg Novi` (or `PRODAVNICA_HERCEG_NOVI`)
- **Cungu API**: `Prodavnica - H.Novi (Meljine)`
- **Status**: 🔴 **NEEDS FIX** - Names don't match exactly

### 3. Ulcinj Centar - CASE MISMATCH
- **Database**: `Prodavnica - Ulcinj Centar` (capital C)
- **Cungu API**: `Prodavnica - Ulcinj centar` (lowercase c)
- **Status**: 🔴 **NEEDS FIX** - Exact match fails due to case sensitivity

## Solution

Update the database store names to match Cungu API exactly:

```sql
-- Fix Ulcinj (case mismatch)
UPDATE stores SET name = 'Prodavnica - Ulcinj centar' 
WHERE name ILIKE 'Prodavnica - Ulcinj%';

-- Fix Herceg Novi (name change)
UPDATE stores SET name = 'Prodavnica - H.Novi (Meljine)' 
WHERE name ILIKE 'Prodavnica - Herceg Novi%';

-- Delete or keep Bijelo Polje (no Cungu data available)
-- DELETE FROM stores WHERE name ILIKE 'Bijelo Polje%';
```

## Testing Store Matching

To test which stores have stock data in Cungu:

```bash
# Get all unique store names from Cungu API
TOKEN=$(curl -s -X POST http://cungu.pantheonmn.net:3003/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestCungu","password":"webshopapi24"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl -s -X POST http://cungu.pantheonmn.net:3003/get \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"method":"getStock","offset":0,"limit":100}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print('\n'.join(sorted(set(o['Objekat'] for item in d for o in item.get('Objekti', [])))))"
```

## Next Steps

1. **Verify database store names** - Check current names in `stores` table
2. **Update to match Cungu exactly** - Run the SQL UPDATE statements above
3. **Sync Zalihe again** - After updating names, click "Sinhroniši Zalihe" 
4. **Verify article counts** - All stores should now show article counts in tabs
