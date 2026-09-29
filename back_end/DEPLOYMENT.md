# Déploiement et migrations

## Mise à jour de sécurité du 29 septembre 2026

Le nouveau code requiert `users.authVersion`, `users.pendingEmail` et la table
`auth_sessions`. La migration doit précéder le redémarrage de l'API. Les jetons
émis par l'ancienne version sont volontairement refusés : tous les utilisateurs
devront se reconnecter. Les nouvelles sessions sont indépendantes par appareil ;
la déconnexion révoque la session courante et un changement/rétablissement du mot
de passe invalide toutes les sessions du compte. Le rôle courant est relu en base.

Le workflow manuel de déploiement exécute désormais :

1. Tests et builds sur le commit sélectionné dans GitHub Actions.
2. Checkout de ce même commit sur le serveur, avec refus si le checkout est modifié.
3. Construction des images, puis sauvegarde MySQL dans `backup/db/`.
4. `docker compose run --rm --no-deps api npm run migrate`.
5. Redémarrage, contrôle des tables/colonnes attendues, lecture des sessions et vérification HTTP de l'API.
6. Vérification du HTML SSR des pages publiques, avec le domaine autorisé.

Le workflow ne restaure pas automatiquement la base en cas d'échec. Consulter les
logs et préserver la sauvegarde ; une restauration aveugle pourrait perdre des
données enregistrées depuis le déploiement. La migration de sécurité est additive,
ce qui permet de remettre une image antérieure sans supprimer les nouvelles
colonnes, mais réactiver une version vulnérable nécessite une décision explicite.

## Historique SQL existant

Les fichiers SQL directement sous `migrations/` appartiennent à l'ancien processus
manuel. Vérifier qu'ils ont été appliqués à la base existante avant d'adopter le
nouveau runner. Ne pas les réexécuter en bloc : certains ajoutent des colonnes,
modifient des données de paiement ou insèrent des articles de démonstration.
Le runner compare toutes les tables et colonnes des entités compilées au schéma
historique (hors ajouts gérés), puis contrôle le schéma complet après migration.
Il ne certifie pas les transformations de données historiques ni tous les types, index et contraintes.

Les nouvelles migrations vont dans `migrations/managed/`, avec un nom ordonné
`YYYYMMDDNNNN-description.cjs` et une fonction `up(db)` exportée. Elles sont
enregistrées dans `schema_migrations` avec une empreinte SHA-256. Une migration
déjà appliquée ne doit jamais être modifiée : ajouter un nouveau fichier.

Un verrou MySQL sérialise les runners. Le DDL MySQL n'est pas transactionnel :
chaque nouvelle migration doit supporter la reprise après une exécution partielle.
La migration de sessions vérifie chaque colonne avant de l'ajouter. Les secrets
de connexion restent dans l'environnement, jamais dans les fichiers de migration.

## Exécution manuelle contrôlée

Sur une base existante sauvegardée, avec les variables DB configurées :

```sh
cd back_end
npm ci
npm run build
npm run migrate
```

Le script utilise les variables du processus (`DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASS`, `DB_NAME`) ; il ne charge pas automatiquement `.env.development`.
Docker Compose les transmet depuis la configuration de l'API.

Sur une nouvelle base de développement jetable, Nest peut créer le schéma avec
`NODE_ENV=development` et `TYPEORM_SYNC=true`. Cette option n'est jamais activée
en production. Le dépôt ne fournit pas un schéma SQL initial complet pour une
installation de production vierge.

## Validation avant production

Exécuter les migrations sur une copie MySQL de la base, puis une seconde fois pour
vérifier qu'elles sont ignorées. Contrôler connexion, renouvellement, déconnexion,
changement de mot de passe, changement d'e-mail et refus d'accès entre comptes.
Vérifier SMTP sur l'environnement de recette et tester la restauration du dump.
Les tests HTTP locaux utilisent SQLite pour les sessions ; ils ne remplacent pas
ce contrôle de migration MySQL.

## Vérifications effectuées le 29 septembre 2026

La dernière passe de correction est détaillée dans `../AUDIT_PREPRODUCTION_2026-09-29.md` :
267 tests backend et 43 tests frontend réussis, builds réussis et audits npm sans alerte.
Le script `node scripts/verify-local-security.cjs` vérifie les quotas concurrents
Classic/Premium sur MySQL local et nettoie ses propres données. Le contrôle du
schéma requiert désormais le build avant `npm run migrate`.

La nouvelle version d'Angular SSR exige les domaines autorisés déclarés dans
`front_end/web/angular.json`. Un changement de domaine doit mettre à jour cette
liste. Un accès direct par localhost à l'image de production peut être refusé ;
le contrôle SSR local utilise un en-tête Host autorisé, comme le reverse proxy.

Historique de la première passe (avant la correction complémentaire) :

- 259 tests backend et 35 tests frontend réussis ; les deux builds réussissent.
- Migration testée sur MySQL 8 dans un conteneur temporaire sans volume persistant :
  refus du schéma préalable absent, première application, réexécution sans doublon,
  réexécution du DDL, valeurs par défaut, rotation conditionnelle à usage unique,
  suppression des sessions en cascade et refus d'une empreinte modifiée.
- Le conteneur de test a été supprimé. Aucune migration ni aucun déploiement n'a
  été exécuté sur la base réelle ou le serveur de production.
- Les trois avertissements de budget SCSS préexistants restent présents.
