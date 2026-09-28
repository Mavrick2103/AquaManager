# Renouvellement Instagram

La connexion utilise Instagram Login et un jeton **longue durée** généré dans la configuration Instagram de Meta. Un jeton expiré/révoqué doit être remplacé manuellement. La tâche ne publie aucun contenu.

## Fonctionnement

- `META_INSTAGRAM_AUTO_REFRESH=true` active la tâche. Docker Compose l'active par défaut ; hors Docker, elle reste désactivée si la variable est absente.
- Première tentative au moins 25 heures après la première lecture du jeton : Meta exige un jeton âgé d'au moins 24 heures, encore valide. Un jeton courte durée ne convient pas.
- Vérification au démarrage et chaque jour à 04:20 UTC. Après succès, renouvellement tous les sept jours (ou plus tôt si la durée retournée l'exige). L'expiration est calculée d'après `expires_in`, pas supposée.
- Échec temporaire : nouvelle tentative quotidienne. Code 190/expiration connue : reconnexion nécessaire, sans boucle d'appels.
- Le volume Docker privé `instagram_tokens`, distinct des médias publics, conserve le jeton renouvelé et ses dates. Écriture atomique, répertoire 0700/fichier 0600. Aucun jeton dans les réponses HTTP ou les logs de ce service.
- Le jeton du `.env` sert à initialiser le stockage. Le jeton sauvegardé est ensuite utilisé pour la vérification **et** la publication. Changer la valeur du `.env` puis recréer l'API remplace volontairement le jeton sauvegardé.
- L'interface admin affiche les erreurs de connexion/renouvellement. Pas d'alerte email pour cette version.

## Mise en production

Après publication du code puis `git pull` sur le VPS, vérifier que le `.env` contient un nouveau jeton longue durée valide et ajouter :

```dotenv
META_INSTAGRAM_AUTO_REFRESH=true
```

```bash
docker compose up -d --build api frontend ssr
```

Aucune migration SQL. Ne pas supprimer le volume `instagram_tokens` lors d'une maintenance (notamment avec `docker compose down -v`). Le sauvegarder comme un secret : il est en clair, protégé par les permissions du serveur et du volume.

Recharger l'administration marketing pour vérifier la connexion. L'endpoint admin existant `GET /api/admin/marketing/instagram/status` expose les dates `lastRefreshedAt`/`expiresAt` sans secret ; elles restent nulles jusqu'au premier renouvellement réussi. Les erreurs de renouvellement sont journalisées sans réponse Meta brute.

Cette implémentation cible l'unique conteneur API du Compose actuel ; ne pas partager ce stockage entre plusieurs processus API actifs sans ajouter un verrou distribué. Une coupure serveur dépassant l'expiration ou une révocation Meta nécessite une reconnexion. L'automatisation n'est active sur le VPS qu'après déploiement.

Référence Meta : https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token
