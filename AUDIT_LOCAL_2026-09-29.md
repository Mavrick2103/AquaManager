# Audit local AquaManager — 29 septembre 2026

> Historique avant correction. La passe suivante corrige les constats ci-dessous ; consulter [le bilan après corrections](AUDIT_PREPRODUCTION_2026-09-29.md) pour l'état actuel et les validations restantes.

## Verdict

Les principales corrections de sécurité fonctionnent sur les scénarios vérifiés. Les tests et compilations réussissent. Cependant, trois défauts fonctionnels sont reproduits, dont un dans le renvoi de vérification ajouté lors de la correction précédente. Il est recommandé de les corriger avant publication.

Cet audit porte sur le code de travail non poussé et sur `localhost:4200` / `localhost:3000`, avec MySQL local. Aucun push ni déploiement n'a été effectué. Il s'agit d'une revue transversale avec essais ciblés, pas d'une certification exhaustive de chaque page et intégration.

## Résultats de validation

| Vérification | Résultat |
| --- | --- |
| Backend, `npm test -- --silent` | 26 suites, 259 tests réussis |
| Frontend, `npm run test:ci` | 35 tests réussis |
| Backend, `npm run build` | Réussite |
| Frontend, `npm run build` | Réussite ; avertissements ci-dessous |
| `git diff --check` | Aucun défaut de whitespace ; avertissements LF/CRLF |
| API locale avec deux comptes distincts | 29 contrôles attendus réussis |
| Créations concurrentes avec un compte Classic | Échec : 5 aquariums obtenus pour une limite de 2 |
| Intercepteur HTTP, exécution isolée du code source | Échec : déconnexion après un renouvellement réussi puis une erreur 400 |
| Renvoi de vérification, services compilés avec dépôt simulé | Échec : une validation concurrente est annulée |

La première compilation Angular a été bloquée par les permissions du bac à sable ; sa relance autorisée hors du bac à sable a réussi. Ce premier échec n'est donc pas retenu comme un défaut du projet.

## Défauts à corriger

### 1. P2 — Dépassement du quota d'aquariums par concurrence

**Preuve : API locale réelle.** Un compte Classic possédant un aquarium a envoyé quatre créations simultanées. Les quatre réponses sont `201` ; le compte possède ensuite cinq aquariums.

Dans `back_end/src/aquariums/aquariums.service.ts:131`, le comptage précède la sauvegarde de la ligne 163, sans sérialisation. Plusieurs requêtes peuvent donc toutes voir une place disponible. Le quota Premium utilise le même mécanisme, même si seule la limite Classic a été reproduite.

**Correction proposée :** sérialiser les créations par utilisateur dans une transaction avec verrou sur une ligne stable, puis recompter et insérer dans cette transaction. Ajouter un test concurrent sur une vraie base.

### 2. P2 — Déconnexion injustifiée après renouvellement de session

**Preuve : exécution isolée de l'intercepteur source, avec réponses HTTP simulées.** Séquence : première requête `401`, renouvellement réussi, requête rejouée `400`. Résultat : un appel à `logout()` et une erreur finale `401`, au lieu de transmettre le `400` métier.

Dans `front_end/web/src/app/core/auth.interceptor.ts:47`, le `catchError` intercepte également les erreurs de la requête rejouée. Une erreur de validation, un refus d'accès ou une panne serveur peut donc déconnecter un utilisateur dont la session vient pourtant d'être renouvelée. Avec la révocation serveur ajoutée, cette déconnexion invalide aussi la session.

**Correction proposée :** distinguer l'échec du renouvellement de l'échec métier de la requête rejouée ; conserver son statut réel et ne révoquer la session que lorsque l'authentification le justifie.

### 3. P2 — Le renvoi d'un e-mail peut annuler une vérification concurrente

**Preuve : scénario déterministe avec les services compilés et un dépôt simulé ; aucune course SMTP réelle déclenchée.** Le renvoi lit un compte non vérifié ; une activation intervient ; l'écriture du renvoi remet ensuite `emailVerifiedAt` à `null`.

`back_end/src/auth/auth.service.ts:108` vérifie l'état avant d'appeler `setEmailVerifyToken`. Dans `back_end/src/users/users.service.ts:228`, cette méthode met à jour le compte uniquement par identifiant et réinitialise sa vérification sans condition atomique.

Ce scénario concerne **le parcours de renvoi ajouté dans mes corrections**. L'utilisateur peut perdre l'accès après avoir validé son adresse, particulièrement si le nouvel envoi échoue.

**Correction proposée :** conditionner atomiquement la mise à jour à l'absence de vérification, contrôler le nombre de lignes modifiées et envoyer le message uniquement si un nouveau jeton a effectivement été enregistré. Tester l'entrelacement activation/renvoi.

### 4. P2 — Les règles de mot de passe du profil ne correspondent pas à l'API

**Preuve : interface observée et lecture du code.** Le profil annonce « 6 caractères minimum » (`profile.component.html:119`) et son validateur utilise `minLength(6)` (`profile.component.ts:148`). L'API impose au moins huit caractères et un caractère spécial dans `back_end/src/users/dto/change-password.dto.ts:9`.

Le texte de la ligne 90 indique aussi que le mot de passe actuel sert uniquement à modifier le mot de passe, alors que la nouvelle modification d'adresse e-mail l'exige également.

**Correction proposée :** aligner validation, messages et aide sur les règles serveur ; ajouter un retour de validation clair avant soumission.

### 5. P2 — Métadonnées de navigation incomplètement appliquées

**Preuve : navigation locale et lecture du routage.** Pendant les parcours espèces/connexion/tableau de bord, le titre de l'accueil reste affiché. Sur le détail d'aquarium, le titre générique demeure et les balises robots/canonical sont absentes lors de l'inspection.

`front_end/web/src/app/app.routes.ts:16` stocke notamment `title` et `robots` dans `data`. Aucune prise en charge globale de ces données n'a été trouvée dans la configuration et le composant racine ; certains composants gèrent leurs métadonnées séparément.

**Correction proposée :** centraliser l'application et la remise à zéro des métadonnées à chaque navigation, ou employer les titres natifs du routeur avec une gestion explicite des autres balises. Vérifier ensuite la sortie SSR et les parcours SPA. Une balise `noindex` n'est pas une protection d'accès.

### 6. P2 — La validation du schéma historique avant déploiement reste partielle

**Preuve : revue du code de mes corrections ; aucune anomalie de schéma local démontrée.** `back_end/scripts/migrate.cjs` vérifie seulement la présence de `users.paypalRenewalActive` pour reconnaître le schéma historique. La présence de cette colonne ne garantit pas toutes les tables et colonnes attendues. Le contrôle de santé du déploiement appelle seulement `/api/fish-cards` (`.github/workflows/cd-deploy.yml:79`).

Le nouveau suivi des migrations améliore le déploiement, mais une base historiquement incomplète pourrait encore passer ces vérifications. La documentation impose déjà une vérification manuelle du socle ; l'automatisation ne la remplace pas.

**Correction proposée :** contrôler explicitement le socle requis et ajouter des contrôles de disponibilité couvrant la base et les nouvelles sessions. Tester une restauration de sauvegarde avant le premier déploiement utilisant ce mécanisme.

## Bilan de mes corrections précédentes

| Correction | État constaté |
| --- | --- |
| Propriété des poissons/plantes d'un aquarium | Les six accès GET/POST/DELETE intercomptes renvoient 404 |
| Distinction jetons d'accès et de renouvellement | Les deux usages croisés sont refusés |
| Rotation du renouvellement | Nouveau jeton obtenu ; ancien jeton refusé au rejeu |
| Révocation à la déconnexion | L'accès avec le jeton de la session révoquée renvoie 401 |
| Validation des modifications d'aquarium | Une dimension invalide est refusée avec 400 |
| Identifiant utilisateur côté frontend | Connexion et parcours authentifié fonctionnent ; tutoriel utilisateur affiché |
| Changement d'e-mail et mot de passe | Logique revue et suites réussies ; livraison réelle des e-mails non vérifiée ; incohérence UI restante |
| Renvoi de vérification | Fonction présente, mais concurrence à corriger (point 3) |
| Migrations et CI/CD | Builds réussis ; limite du contrôle historique au point 6 |

Le test MySQL temporaire des migrations réalisé lors de la correction précédente avait validé l'application, la répétition, les contraintes et la détection d'une migration modifiée. Il n'a pas été rejoué intégralement pendant cette passe d'audit.

## Couverture fonctionnelle et limites

Les pages d'accueil, espèces, connexion, aquariums, détail d'aquarium, mesures, tâches, calendrier et profil ont été parcourues localement. Les mesures et tâches créées par API apparaissent dans l'interface ; le calendrier présente la tâche à la date attendue. Aucun chevauchement majeur n'a été observé sur la vue bureau examinée.

Les contrôles API couvrent aussi le résumé du tableau de bord, le profil, les réglages, la gamification, les recommandations, l'interdiction d'accès administrateur à un utilisateur ordinaire et l'interdiction de l'IA à un compte Classic. Ces refus ne valident pas les parcours autorisés complets de l'administration et de l'offre Premium.

Restent non validés de bout en bout : paiement et renouvellement Stripe/PayPal, webhooks, livraison SMTP, génération IA réelle, mutations de toute l'administration, tous les formulaires publics, rendu mobile, accessibilité complète, charge et configuration de production. Aucun score Lighthouse ou de couverture exhaustive n'est revendiqué.

## Entretien et performances

- Le bundle initial de production totalise environ 1,36 Mo brut / 342 Ko estimés transférés. Cela mérite une mesure de performance réelle ; ce chiffre seul ne prouve pas une lenteur.
- Trois feuilles SCSS dépassent leur budget : statistiques administrateur (28,88 Ko), utilisateurs administrateur (21,27 Ko), détail aquarium (44,97 Ko).
- L'outil `baseline-browser-mapping` signale des données anciennes.
- Les sessions expirées sont refusées, mais aucune purge périodique n'a été identifiée dans le service de sessions : prévoir leur nettoyage pour éviter une croissance inutile.

## Nettoyage et ordre recommandé

Les deux comptes jetables, leurs six aquariums et leurs données liées ont été supprimés de la base locale. L'absence des aquariums de test a été vérifiée. Le fichier temporaire contenant leurs identifiants et jetons a été supprimé.

Corriger d'abord les points 1 à 3 avec des tests ciblés, aligner les formulaires et métadonnées, puis compléter les contrôles de déploiement. Avant publication, terminer les essais des prestataires en environnement de test et la vérification mobile/accessibilité. Aucun correctif applicatif supplémentaire n'a été intégré pendant cette passe d'audit.
