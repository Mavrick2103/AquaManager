# Corrections et audit avant production — 29 septembre 2026

## État actuel

Les six points de l'audit local précédent ont reçu une correction. La poursuite de la revue a aussi corrigé la résiliation Stripe immédiate, la suppression de comptes Stripe actifs, l'invalidation des sessions après changement d'e-mail administrateur et les pièces jointes du contact. Les dépendances ont été mises à jour, puis les tests et builds relancés.

Le code local est validé sur les scénarios décrits ici. Ce rapport ne donne pas encore un feu vert inconditionnel à la production : les essais réels des prestataires et une restauration de sauvegarde restent à réaliser en recette. Aucun push, paiement, envoi SMTP réel ou déploiement de production n'a été effectué.

## Corrections vérifiées

| Sujet | Correction et preuve |
| --- | --- |
| Quota Classic/Premium | Transaction MySQL et verrou par utilisateur ; calcul du plan sur l'utilisateur verrouillé. Sur 8 créations concurrentes : exactement 2 acceptées en Classic, 5 en Premium, le surplus refusé avec 403. |
| Session après renouvellement | L'intercepteur conserve les erreurs métier 400/403/404/500 sans déconnecter. Un nouvel échec 401 révoque la session. Tests ciblés, dont renouvellement refusé et retour nul. |
| Renvoi de vérification | Mise à jour atomique seulement si le compte est toujours non vérifié ; aucun nouvel envoi si l'activation a gagné la course. Test unitaire et contrôle MySQL. |
| Formulaire du profil | Minimum de 8 caractères et caractère spécial, aide corrigée pour le changement d'e-mail ; limite du nom alignée sur l'API. |
| Métadonnées | Métadonnées de route appliquées avant activation ; les fiches dynamiques gardent leurs propres titres. Nettoyage des données structurées, robots et canonicals entre pages ; tests de navigation. |
| Schéma/déploiement | Vérification de toutes les tables et colonnes des entités compilées, avant et après migration, puis contrôle de disponibilité base/API. Un socle simulé sans `users.password` est refusé. |
| Stripe | L'annulation immédiate appelle réellement `subscriptions.cancel` ; la fin de période reste une annulation programmée. Tests avec prestataire simulé. Suppression du compte et modification manuelle des droits bloquées tant que le statut local Stripe n'est pas terminé. |
| E-mail modifié par un administrateur | Incrément atomique de la version des sessions et suppression des anciens jetons de réinitialisation ; test de régression. |
| Contact | Pièces jointes en mémoire, sans dépendance à `/tmp/contact`, limite totale de 10 Mo. Essais multipart avec validation et rejet des types interdits ; composition MIME testée avec Nodemailer sans réseau SMTP. |
| Sessions expirées | Purge quotidienne à 3 h, selon le fuseau du processus serveur. Les sessions expirées restent refusées indépendamment de cette purge. |

## Dépendances

L'audit npm initial des dépendances de production signalait 16 paquets concernés côté backend et 13 côté frontend, avec des niveaux élevés et critiques. Ces nombres comprennent des dépendances touchées indirectement ; ils ne représentent pas autant de failles démontrées exploitables sur le site.

Après correction, **`npm audit --json` retourne zéro alerte dans les deux projets, dépendances de développement comprises**, à la date de cette vérification.

Versions principales : Nest 11.2.6, Multer 2.4.0, Angular 20.3.32 et outils/SSR 20.3.37. Nodemailer passe à 10.0.12 ; SQLite, utilisé par les tests, à 6.0.1. Ces deux derniers changements franchissent une version majeure et ont été vérifiés par compilation et tests, dont composition des e-mails et tests HTTP utilisant SQLite. Les fichiers de verrouillage npm sont mis à jour et `npm ls --depth=0` frontend ne signale pas de conflit.

## Résultats finaux

- **Backend : 29 suites, 267 tests réussis.**
- **Frontend : 43 tests réussis dans Chrome Headless.**
- Builds Nest et Angular navigateur/SSR réussis après mises à jour.
- Contrôles MySQL locaux réussis, avec suppression des comptes et aquariums temporaires.
- `git diff --check` sans erreur de whitespace.
- Page contact rechargée après redémarrage Angular : aucun message console de niveau erreur observé.
- Connexion et contact inspectés à 390 × 844 ; pas de débordement horizontal sur le contact, formulaire de connexion lisible et utilisable. Ce contrôle ne couvre pas toutes les pages mobiles.

La nouvelle version SSR exige une liste explicite de domaines autorisés. `angular.json` déclare uniquement `aquamanager.fr` et `www.aquamanager.fr` pour la production. La vérification a utilisé un serveur de build local sur le port 4100, un en-tête Host correspondant au domaine autorisé et l'API locale : aucune requête n'a été envoyée au site de production.

Accueil, espèces, articles et fiche poisson ont répondu 200 avec titre spécifique, H1 et métadonnées dans le HTML serveur. Une fiche inexistante a répondu 404 avec `noindex`. Le contrôle `scripts/check-ssr.cjs` est intégré à l'image SSR et au workflow de déploiement pour détecter notamment un retour involontaire au seul rendu client.

## Points restant avant publication

1. Sur une copie de la base de production : appliquer puis rejouer les migrations et tester la restauration du dump. Le contrôle des colonnes ne certifie pas toutes les contraintes, tous les types ni les transformations de données historiques.
2. En recette avec les prestataires : inscription/activation, changement d'e-mail, récupération du mot de passe et contact avec réception SMTP effective ; paiement PayPal, renouvellement, annulation et réception des webhooks. Les tests locaux utilisent des simulations pour les prestataires.
3. Vérifier le parcours Stripe historique si des comptes Stripe existent encore, notamment la confirmation de fin d'abonnement avant suppression du compte.
4. Compléter les parcours mobiles authentifiés, l'accessibilité au clavier/lecteur d'écran et la charge. Les vérifications actuelles ne constituent pas un audit WCAG complet.

Les trois avertissements SCSS restent non bloquants : détail aquarium 44,94 Ko, statistiques administrateur 28,85 Ko et utilisateurs administrateur 21,24 Ko pour un budget d'avertissement de 20 Ko. Ils n'ont pas été masqués en augmentant les budgets.

## Reproduire les contrôles locaux

Après installation des dépendances et compilation du backend :

```text
back_end : npm test -- --silent
back_end : npm run build
back_end : node scripts/verify-local-security.cjs
front_end/web : npm run test:ci
front_end/web : npm run build
chaque projet : npm audit --json
```

Le script MySQL utilise uniquement `.env.development`, refuse une adresse de base hors loopback, crée ses propres données jetables et les nettoie. Il n'envoie aucun e-mail et ne contacte aucun prestataire. Le site Angular local a été relancé sur le port 4200.
