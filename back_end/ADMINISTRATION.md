# Administration — refonte du 30 septembre 2026

## Navigation

L’entrée `/admin` redirige vers `/admin/metrics`. Le menu est partagé entre le pilotage, les comptes, les abonnements, les contenus, la communication et la surveillance technique. Sur mobile, il se déplie avec le bouton Menu. Les éditeurs ne voient que les contenus autorisés ; les contrôles d’accès backend restent obligatoires.

## Périmètre des chiffres

- Les nouveaux inscrits sont comptés à partir de `users.createdAt`. Les dix derniers comptes de la période sont accessibles depuis la vue d’ensemble.
- Un utilisateur actif possède une dernière activité dans la période. Il ne s’agit pas d’un historique exhaustif des connexions.
- Les accès Premium / Pro actifs incluent les accès offerts et les essais. Les échéances des sept prochains jours correspondent à la fin de la période d’accès actuelle, y compris les abonnements renouvelables. Ces compteurs ne constituent pas un chiffre d’affaires.
- La page Abonnements affiche les souscriptions PayPal, avec les paiements réels par défaut. Les tests Sandbox restent consultables séparément. Les compteurs suivent la recherche et l’environnement ; le tableau applique aussi les filtres d’état et « À vérifier ». Les statuts sont ceux de la dernière synchronisation, dont la date est affichée.
- Les périodes payées, remboursements et vérifications manuelles restent consultables dans le détail d’un abonnement. Aucun changement n’est apporté au mécanisme de paiement ou de résiliation.

## Serveur et journaux

`GET /api/admin/operations` propose un journal de 25 événements par page, filtrable sur 1, 7, 30 ou 90 jours, par catégorie et route. L’accès nécessite le rôle ADMIN. Les erreurs de stockage renvoient 503, pas une liste vide.

Le journal contient les erreurs HTTP 5xx captées par l’intercepteur applicatif. Une catégorie décrit le parcours concerné, pas une panne certaine d’un prestataire. Les nouvelles erreurs PayPal ont leur propre catégorie ; les anciens événements ne sont pas reclassés. Les routes sont enregistrées sous forme de modèles, sans paramètres d’URL, jetons, corps de requête ni traces détaillées.

`GET /api/admin/operations/health` contrôle MySQL, le système de fichiers accessible à l’API, les fichiers de sauvegarde, la mémoire du processus et sa durée de fonctionnement. Il ne mesure pas la disponibilité de tout le VPS. Les sauvegardes sont recherchées dans `BACKUP_DIR` (défaut `/backups`), aux formats `.sql` et `.sql.gz`. Un fichier vide est ignoré. Ce contrôle ne valide ni son intégrité ni sa restauration. Le Compose existant monte `./backup/db:/backups:ro`. Sans accès au répertoire, l’état reste « Non vérifié ».

Les journaux Docker/Nginx complets, erreurs du navigateur et tâches planifiées ne sont pas couverts par le journal applicatif. Pour investiguer depuis le VPS :

```bash
docker compose logs --since=1h --tail=200 api
docker compose logs --since=1h --tail=200 frontend ssr
docker compose ps
```

## Déploiement et validation

Aucune nouvelle migration : utilisation des tables existantes, notamment `operational_events` et les tables PayPal. La nouvelle catégorie PayPal utilise la colonne varchar existante. Les migrations antérieures du projet doivent déjà être appliquées. Déployer ensemble l’API, le frontend et le SSR avec la procédure habituelle.

Validations locales : compilation Nest/Angular, suite backend, suite Angular et `cypress/e2e/admin-workspace.cy.ts`. Les scénarios navigateur utilisent des réponses simulées ; les tests fonctionnels vérifient les requêtes de filtrage/pagination sur SQLite. Un contrôle en lecture seule sur MySQL local (`node scripts/verify-local-admin.cjs`, après compilation du backend) vérifie aussi les indicateurs, la cohérence des courbes, les champs retournés et les filtres PayPal. Il refuse les hôtes distants et les environnements de production. Ces validations ne remplacent pas un contrôle après déploiement. Aucun envoi d’email, appel PayPal ou déploiement de production n’est réalisé par ces tests.

## Dossier utilisateur
La fiche `/admin/users/:id` comporte une synthèse et 18 historiques paginés (25 éléments par page). Les routes `GET /admin/users/:id/dossier` et `GET /admin/users/:id/records/:section` sont réservées aux administrateurs. Les champs exposés sont explicitement sélectionnés ; mots de passe, jetons et identifiants de visiteurs sont exclus.

Les aquariums masqués sont inclus avec leurs dates de conservation. Mesures, tâches, population, objectifs, bilan, recommandations, usages IA et contributions restent rattachés à leur propriétaire. Le filtre aquarium est disponible depuis un bac. Les paiements PayPal réels et Sandbox sont identifiés séparément ; aucun montant n’est inventé et le détail financier Stripe reste chez le prestataire. Le nombre de sessions non expirées ne représente pas une présence en ligne.

Cette fiche utilise les tables existantes : aucune nouvelle migration. Vérifications : `npm test -- --runTestsByPath test/Fonctionnel/admin-user-dossier.functional.spec.ts`, `node scripts/verify-local-admin.cjs` après compilation (base locale, lecture seule), et Cypress `admin-user-dossier.cy.ts`.
