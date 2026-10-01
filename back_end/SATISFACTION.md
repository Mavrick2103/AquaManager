# Satisfaction utilisateur

- Questionnaire : invitation sur le tableau de bord et bouton Donner mon avis dans le profil.
- Invitation après 7 jours depuis la création du compte et 3 jours UTC distincts de visite du tableau de bord, comptés à partir de cette mise à jour.
- Plus tard reporte l’invitation de 7 jours. Une réponse bloque un nouvel envoi pendant 90 jours, y compris depuis le profil. Le profil permet une première réponse sans attendre les critères d’invitation.
- Les écritures utilisent une transaction et verrouillent le compte pour empêcher les doubles envois concurrents.
- L’offre effective et la source (Classic, Premium payant, offert, équipe) sont figées à l’envoi. Le type payant se fonde sur billingProvider, pas sur un rapprochement comptable de chaque paiement.
- Les administrateurs et éditeurs sont identifiés Équipe et exclus des indicateurs par défaut.
- Satisfaction : part de notes 4 ou 5 / toutes les réponses du périmètre. La question Premium a son propre indicateur. Les avis volontaires ne représentent pas nécessairement tous les inscrits.
- Les statistiques comptent les réponses, pas les personnes uniques. Le suivi À lire / Lu / Traité ne modifie pas les indicateurs.
- Les commentaires sont associés au compte et visibles uniquement par les administrateurs. Le formulaire le précise. La suppression du compte supprime en cascade ses réponses et son état de questionnaire.

## Déploiement

Migration : migrations/managed/202610010001-satisfaction.cjs.
Après sauvegarde de la base et construction de la nouvelle image API, exécuter `docker compose run --rm --no-deps api npm run migrate`, puis recréer les services applicatifs. Le workflow CD existant effectue déjà la sauvegarde et la migration avant de recréer les conteneurs.
Le contrôle initial de schéma ignore les nouvelles tables en mode legacy ; la vérification finale les exige. Ne pas modifier une migration déjà appliquée.
