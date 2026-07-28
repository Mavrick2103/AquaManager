START TRANSACTION;

-- Conserve le slug publié afin de ne pas casser les liens Instagram existants.
UPDATE articles
SET
  title = 'Paramètres d''eau expliqués : pH, KH, GH, NO2, NO3, valeurs cibles et corrections sans risques',
  updatedAt = CURRENT_TIMESTAMP(6)
WHERE slug = 'parametres-deau-expliquer-ph-kh-gh-no2-no3-valeurs-cibles-et-corrections-sans-risques';

-- Corrige le libellé uniquement si la version correcte n'existe pas déjà.
UPDATE themes AS broken
LEFT JOIN themes AS correct ON correct.name = 'Paramètres'
SET
  broken.name = 'Paramètres',
  broken.updatedAt = CURRENT_TIMESTAMP(6)
WHERE broken.name = 'Paramtres'
  AND correct.id IS NULL;

COMMIT;
