# Administration des abonnements PayPal

Page `/admin/subscriptions`, accessible depuis le menu administrateur et le profil.
API `/api/admin/subscriptions` protégée par authentification et rôle ADMIN, y compris le détail et la vérification manuelle.

La liste paginée affiche les abonnements et anciennes tentatives PayPal. Filtres : utilisateur/référence, environnement, éléments à vérifier. Les droits actuels du compte sont distingués des périodes payées d'une ancienne souscription. Les accès offerts et Stripe restent gérés dans la fiche utilisateur existante.

La fiche affiche les 100 derniers paiements enregistrés et les 100 dernières vérifications administrateur. Les montants affichés sont les montants d'origine vérifiés, pas le montant remboursé. Le marqueur de remboursement couvre aussi les remboursements partiels. Les confirmations email historiques marquées comme tentées sans date de succès nécessitent une vérification et ne prouvent pas un échec de livraison.

La vérification manuelle utilise la même validation serveur et le même verrou par utilisateur que les webhooks. Elle ne crée ni débit ni remboursement. Elle peut déclencher la confirmation email normale d'un paiement nouvellement reconnu. L'identifiant de l'administrateur, la cible, la date et le résultat sont persistés dans `paypal_admin_actions`. Une action STARTED ancienne indique une vérification interrompue. Aucune clé, réponse PayPal brute ou lien d'approbation n'est exposé.

En production, après les migrations PayPal précédentes, exécuter une seule fois `migrations/202609270002-paypal-admin-actions.sql` avant de redémarrer le backend. En local avec TYPEORM_SYNC=true, la table est créée automatiquement. Cette modification ne déploie rien sur le VPS.
