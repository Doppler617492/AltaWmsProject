# Kako Dodati PWA Redesign

## TL;DR - Brzo Uputstvo

Sve potrebne utility fajlove i tipove smo već kreirali. Sada trebate:

1. **Instalirati dependencies** (ako nemate):
   ```bash
   npm install framer-motion lucide-react canvas-confetti
   ```

2. **Kopirati komponente** koje ću generisati u ovom fajlu

3. **Dodati rutu** za novi ekran

## Kreiranje Komponenti

### 1. ItemCard.tsx

Kreirajte fajl: `frontend-pwa/src/components/receiving/ItemCard.tsx`

**⚠️ IMPORTANT:** Ovaj fajl je veliki (200+ linija). Možete ga podeliti ili uzeti inline verziju bez animation library-ja ako ne želite instalisati framer-motion.

**Alternativa:** Možete koristiti jednostavnu verziju bez animacija samo sa CSS transitions.

### 2. RightPanel.tsx

Kreirajte fajl: `frontend-pwa/src/components/receiving/RightPanel.tsx`

Panel je Sheet/Dialog sa slide-in animacijom. Takođe možete koristiti obični div sa CSS transform ako ne želite framer-motion.

### 3. ConfirmReceiptScreen.tsx

Kreirajte fajl: `frontend-pwa/src/screens/ConfirmReceiptScreen.tsx`

Glavni ekran koji koristi obe komponente iznad.

### 4. Page wrapper

Kreirajte fajl: `frontend-pwa/pages/pwa/receiving/confirm.tsx`

```tsx
import ConfirmReceiptScreen from '../../src/screens/ConfirmReceiptScreen';
export default ConfirmReceiptScreen;
```

## Bez Framewo

Ako **ne želite** instalirati framer-motion ili lucide-react, mogu da napravim:
- **Plain CSS** verziju sa Tailwind animacijama
- **SVG ikone** umesto lucide-react
- **Native transitions** umesto framer-motion

Molim vas da me informišete šta preferirate!

## Next Steps

Odgovorite sa:
1. ✅ "Instaliraj dependencies i kreiraj sve komponente"
2. ✅ "Kreiraj verziju bez framer-motion/lucide-react"
3. ✅ "Samo mi daj kod pa ću ja kopirati"

Ja ću nastaviti sa kreiranjem!












