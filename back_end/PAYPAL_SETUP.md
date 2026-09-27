# PayPal — Premium 3,99 EUR par mois

Le code utilise les API REST PayPal Subscriptions. Les nouvelles souscriptions passent par PayPal ; les abonnements Stripe existants conservent leur portail et leurs notifications. L’offre Pro et les paiements ponctuels ne sont pas vendus par cette intégration.

## 1. Configurer et tester en Sandbox

- Créer une application PayPal **Sandbox** sur le compte Business.
- Créer un produit numérique et un plan actif : **3,99 EUR**, chaque **1 mois**, durée illimitée, sans essai gratuit, frais de mise en service ni supplément de taxe. Le prix affiché est le montant total payé ; configurer séparément les obligations fiscales de l’activité.
- Le plan doit appartenir au même compte marchand et être accessible via les identifiants de l’application. Le plan Live existant `P-8HL359614K9315155NK37T2I` ne peut pas servir en Sandbox. Le serveur vérifie le montant, la devise et la fréquence avant chaque nouvelle souscription.
- Utiliser une base/installation de test distincte de la production. Les données Sandbox ne doivent pas être copiées dans la base Live.

Dans le `.env` privé lu par Docker Compose (ou `.env.development` pour un serveur Nest local), renseigner :

```dotenv
PAYPAL_ENABLED=false
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=identifiant_application_test
PAYPAL_CLIENT_SECRET=secret_application_test
PAYPAL_PLAN_PREMIUM=identifiant_plan_test
PAYPAL_WEBHOOK_ID=identifiant_webhook_test
APP_URL=https://adresse-publique-de-test
```

Ne jamais committer le secret, le copier dans le frontend ou le publier dans une conversation. Les noms ci-dessus sont des exemples, pas des identifiants fonctionnels.

## 2. Migration et déploiement

La base doit avoir les migrations précédentes. Sauvegarder la base, puis appliquer **une seule fois** `migrations/202609260001-paypal-subscriptions.sql` avant de lancer le nouveau backend. MySQL exécute les changements de structure séparément : en cas d’échec partiel, vérifier les colonnes et tables déjà créées avant de reprendre.

Depuis le dossier du projet sur le serveur Linux :

```bash
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"' < back_end/migrations/202609260001-paypal-subscriptions.sql
docker compose up -d --build api frontend ssr
```

Le workflow GitHub existant ne lance PAS la migration. Récupérer d’abord le fichier de migration depuis le code publié, migrer, puis déployer. Aucun achat n’est possible tant que `PAYPAL_ENABLED=false`.

## 3. Ajouter le webhook dans la même application PayPal

Dans Applications et identifiants → AquaManager → Webhooks, ajouter l’adresse HTTPS du backend de test. Pour le site réel, l’adresse prévue est :

`https://aquamanager.fr/api/billing/paypal/webhook`

Sélectionner :

- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`

Reporter l’identifiant du webhook dans `PAYPAL_WEBHOOK_ID`, puis mettre `PAYPAL_ENABLED=true` sur l’installation de test et recréer le conteneur API. PayPal doit pouvoir joindre l’adresse HTTPS publiquement. Les notifications IPN et la redirection automatique des anciens boutons PayPal ne sont pas utilisées.

La vérification utilise l’API `verify-webhook-signature` : tester avec de vrais achats **Sandbox**. Le simulateur de webhooks PayPal n’est pas compatible avec cette méthode de vérification.

## 4. Recette obligatoire avant ouverture Live

1. Utiliser un compte AquaManager de test, non administrateur, avec email vérifié et sans autre abonnement. Depuis le profil, lancer Premium. Payer avec un compte acheteur Sandbox distinct du vendeur.
2. Vérifier le montant 3,99 EUR et la périodicité mensuelle affichés par PayPal, puis le retour vers le profil. L’accès ne s’active qu’après une transaction COMPLETED vérifiée, jamais sur la seule approbation ou sur le paramètre de retour.
3. Vérifier le webhook, puis son renvoi : aucune extension supplémentaire. Actualiser le profil si le paiement est encore en attente.
4. Vérifier qu’un autre compte ne peut pas récupérer l’abonnement et qu’une deuxième souscription active est bloquée.
5. Vérifier un renouvellement, une annulation depuis AquaManager et depuis PayPal, un paiement échoué, une suspension, un remboursement, un événement retardé et une indisponibilité temporaire de l’API. Une résiliation ne supprime pas une période déjà payée. Un remboursement, même partiel, invalide conservativement le droit associé à cette transaction.
6. Vérifier la fin des droits après expiration et le fonctionnement du portail Stripe pour un ancien abonné.

Les tests unitaires simulent PayPal : ils ne remplacent pas cette recette avec MySQL et PayPal Sandbox.

## 5. Ouvrir les paiements réels

Sur la production migrée, utiliser les identifiants de l’application **Live**, son webhook Live et le plan Live, après avoir confirmé son prix. Définir `PAYPAL_ENV=live`, `APP_URL=https://aquamanager.fr` et `PAYPAL_ENABLED=true`, puis recréer l’API. Le `.env.example` reste désactivé par défaut.

Ne plus diffuser le lien statique de souscription : les utilisateurs doivent passer par le bouton AquaManager afin que le serveur associe l’abonnement à leur compte. Les abonnements déjà créés via un lien externe ne sont pas repris automatiquement.

## Fonctionnement et exploitation

- Les identifiants d’abonnement et les paiements sont conservés dans des tables dédiées. Un identifiant opaque lie la souscription au compte. Les opérations d’un même utilisateur sont sérialisées via un verrou MySQL.
- La création utilise un identifiant de requête persistant pour éviter les doublons en cas de timeout. Une création restée ambiguë plus de 70 heures est bloquée : vérifier les abonnements du marchand dans PayPal avant toute intervention manuelle. Ne jamais supprimer arbitrairement cette tentative pour recommencer.
- Les notifications sont vérifiées chez PayPal avant traitement. L’état de l’abonnement et ses transactions récentes sont ensuite relus par API. Le même paiement ne prolonge pas deux fois les droits ; un remboursement reste mémorisé malgré des événements plus anciens.
- Un rapprochement automatique s’exécute chaque heure à la minute 15 et récupère les transactions des 31 derniers jours. Il continue pour les clients existants quand les nouvelles ventes sont désactivées, tant que les identifiants sont configurés.
- Les droits expirent à la fin du mois payé, calculée à partir du calendrier de l’abonnement. Un paiement refusé ne prolonge pas l’accès. Une annulation conserve la période payée.
- Chaque souscription désactive le report automatique des impayés sur le prélèvement suivant (`auto_bill_outstanding=false`) et demande la suspension après un cycle de paiement échoué (`payment_failure_threshold=1`). Les relances de PayPal restent possibles. Ne pas capturer manuellement un solde impayé ni modifier le prix d’un abonnement existant : cette intégration traite les mensualités individuelles de 3,99 EUR.
- La suppression du compte et les modifications manuelles de formule sont bloquées tant que PayPal peut encore renouveler l’abonnement. Résilier d’abord dans le profil et actualiser son statut.
- En cas d’échec d’une notification, le serveur répond en erreur pour permettre une nouvelle tentative PayPal. Surveiller les échecs dans le tableau de bord PayPal et les journaux de l’API. Une panne n’est pas une preuve de paiement.

Documentation : https://developer.paypal.com/subscriptions/integrate ; https://developer.paypal.com/api/rest/webhooks/rest/
