# TDS et conductivité — 30 octobre 2026

Deux mesures facultatives indépendantes sont disponibles dans le formulaire Nouvelle mesure, en Classic comme en Premium : TDS en ppm et conductivité en µS/cm. Elles sont proposées pour les deux types d’eau, avec les mêmes unités partout. Aucune conversion entre les deux n’est effectuée.

Les valeurs sont reprises du dernier relevé selon le mécanisme existant, sans écraser une saisie en cours. Effacer un champ l’enregistre comme inconnu (`NULL`), et zéro reste une valeur mesurée valide. Les anciens relevés ne reçoivent aucune valeur artificielle.

L’historique, la fiche administrateur et les graphiques prennent en charge les deux paramètres. Les graphiques correspondants apparaissent lorsqu’au moins un relevé les renseigne et restent sans plage de référence automatique. Ils n’ajoutent aucun seuil universel ni aucun diagnostic de pollution au bilan Classic.

L’IA reçoit les valeurs avec leurs unités, aussi bien en analyse texte qu’en analyse photo. Les instructions lui demandent de ne pas convertir sans le facteur de l’appareil, de ne pas remplacer GH/KH/NO2/NO3 et de ne pas conclure sur la qualité de l’eau à partir de ces seules mesures.

Les bornes de saisie sont des limites techniques, pas des valeurs recommandées pour un aquarium : TDS de 0 à 100 000 ppm ; conductivité de 0 à 200 000 µS/cm. Les nombres négatifs, non numériques ou infinis sont refusés par l’API. Les champs restent facultatifs.

## Migration obligatoire

Fichier : `back_end/migrations/managed/202610300001-water-tds-conductivity.cjs`.

La migration ajoute deux colonnes `FLOAT NULL` à `water_measurements`, sans modifier les relevés existants. Elle vérifie l’existence de chaque colonne avant ajout. Le contrôle du schéma accepte leur absence pendant la vérification préalable des anciennes installations, puis exige leur présence après les migrations.

Reconstruire l’image API avec le nouveau code avant de lancer le mécanisme habituel de migration, puis recréer les services applicatifs. Pour le déploiement Docker Compose, après la sauvegarde habituelle de la base :

```sh
docker compose build api ssr frontend
docker compose run --rm --no-deps api npm run migrate
docker compose up -d api ssr frontend
```

Le job de déploiement peut déjà exécuter ces étapes ; ne pas les doubler s’il les prend en charge. Les autres migrations en attente sont aussi appliquées par `npm run migrate`.

## Validation

- 67 tests unitaires frontend réussis.
- 31 tests serveur ciblés réussis, incluant la validation des données, la conservation de zéro et des décimales et le contexte IA texte/photo.
- 18 scénarios navigateur réussis : trois nouveaux pour TDS/conductivité et quinze de régression sur mesures, Solutions et récupération après erreur. Le premier essai du nouveau test n’ouvrait pas la section de graphiques repliée ; après correction de cette interaction, les trois scénarios passent.
- Compilations frontend et API réussies ; avertissements de taille CSS existants sur l’accueil et le détail aquarium.
- Migration exécutée deux fois dans une base MySQL temporaire isolée : ancien relevé conservé, nouvelles colonnes initialisées à NULL, zéro et décimales conservés. La base de test a été supprimée ensuite.
- Capture mobile du formulaire inspectée et accessibilité des actions contrôlée.

Aucune base applicative ni base de production n’a été migrée pendant cette intervention. Aucun appel réel à l’IA n’a été effectué. Le serveur de vérification frontend a été arrêté après les tests.
