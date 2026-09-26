# Rappels d'entretien

## Mise en service

1. Appliquer une seule fois `migrations/202609250001-add-task-reminder-tracking.sql` à la base MySQL avant de redémarrer cette version de l'API. Les migrations précédentes doivent déjà être appliquées.
2. Utiliser la configuration SMTP et APP_URL déjà requise par les autres emails.
3. Le compte destinataire doit avoir un email vérifié et activer les notifications générales, les emails et les rappels d'entretien dans son profil. Aucun abonnement payant n'est nécessaire.

## Comportement

- Un récapitulatif quotidien, à partir de 09:00 Europe/Paris, uniquement si des tâches du jour restent à faire.
- Vérification toutes les 15 minutes après 09:00 pour rattraper une indisponibilité ou réessayer un échec SMTP dans la même journée.
- Les tâches ponctuelles terminées et les occurrences récurrentes terminées sont exclues. Les modes de répétition utilisent les règles UTC du calendrier ; leur affichage et la sélection du jour utilisent Europe/Paris, y compris lors des changements d'heure.
- Les occurrences avant le début de la série ou à partir de sa borne de fin exclusive ne sont pas envoyées.
- Toutes les tâches du jour sont regroupées par utilisateur. Pas de rappel des jours passés. Pas de second email pour les tâches ajoutées après le récapitulatif. En l'absence de tâches, la journée n'est pas marquée envoyée et une tâche ajoutée ensuite pourra être rappelée.
- Le verrou MySQL empêche deux instances de traiter simultanément les rappels. La date du dernier envoi reste enregistrée après redémarrage. Aucune connexion administrateur n'est nécessaire pour déclencher le traitement.

## Limite SMTP

L'envoi SMTP et l'écriture de la date en base ne constituent pas une transaction unique. Si le serveur s'arrête après acceptation de l'email mais avant l'enregistrement, ou si un timeout SMTP masque une acceptation, un doublon reste possible lors d'une nouvelle tentative. Un envoi exactement une fois nécessiterait un fournisseur proposant une clé d'idempotence. Les erreurs sont journalisées sans enregistrer la journée comme envoyée.

## Recette de déploiement

Sur une base de test et un serveur SMTP de test : créer un compte vérifié et consentant, une tâche du jour et une occurrence terminée. Après 09:00 Paris, vérifier que seul l'entretien restant figure dans le récapitulatif ; relancer le traitement et vérifier l'absence de nouvel envoi. Désactiver les rappels et vérifier l'absence d'envoi. Aucun email réel n'est envoyé par les tests unitaires.
