DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT *
    FROM (VALUES
      ('MP Ulcinj', 'MP_ULCINJ'),
      ('MP Ulcinj Centar', 'MP_ULCINJ_CENTAR'),
      ('MP Bar', 'MP_BAR'),
      ('MP Bar Centar', 'MP_BAR_CENTAR'),
      ('MP Budva', 'MP_BUDVA'),
      ('MP Kotor Centar', 'MP_KOTOR_CENTAR'),
      ('MP Herceg Novi', 'MP_HERCEG_NOVI'),
      ('MP Sutorina', 'MP_SUTORINA'),
      ('MP Nikšić', 'MP_NIKSIC'),
      ('MP Podgorica', 'MP_PODGORICA'),
      ('MP Podgorica Centar', 'MP_PODGORICA_CENTAR'),
      ('MP Bijelo Polje', 'MP_BIJELO_POLJE'),
      ('MP Berane', 'MP_BERANE')
    ) AS s(name, code)
  LOOP
    INSERT INTO stores (name, code, is_active, created_at)
    VALUES (rec.name, rec.code, TRUE, NOW())
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      is_active = TRUE;
  END LOOP;
END $$;
