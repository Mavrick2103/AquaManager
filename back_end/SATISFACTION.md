# Satisfaction utilisateur

- Questionnaire : fenêtre automatique à la première visite authentifiée du mois, après le tutoriel éventuel, et bouton Donner mon avis dans le profil.
- Un mois entre deux réponses (Europe/Paris), y compris depuis le profil : un avis le 29 septembre permet de répondre le 29 octobre, à la même heure locale. Si le jour n’existe pas le mois suivant, on utilise son dernier jour (31 janvier → 28 ou 29 février). La fenêtre revient à la première visite éligible.
- L’invitation est réservée une seule fois par mois sous verrou du compte, pour éviter les répétitions entre appareils et onglets. Plus tard ferme la fenêtre ; le profil reste disponible. Les comptes équipe ne reçoivent pas la fenêtre automatique.
- Cette évolution réutilise les colonnes existantes : aucune nouvelle migration. Les avis déjà enregistrés sont conservés et soumis à la règle mensuelle.
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
