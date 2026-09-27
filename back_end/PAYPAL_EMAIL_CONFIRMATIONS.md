# Confirmation des paiements Premium

Le retour PayPal affiche une notification temporaire pendant six secondes. Les paramètres de retour sont ensuite retirés de l’URL pour éviter de rejouer la confirmation au rechargement. Le bouton d’actualisation reste dans la section abonnement.

Chaque nouveau paiement confirmé de 3,99 EUR pour une période en cours déclenche une confirmation à l’adresse vérifiée du compte AquaManager. L’email indique le montant, la référence du paiement, la date de fin de période et un lien vers le profil. En Sandbox, le sujet et le contenu indiquent explicitement qu’il s’agit d’un test. Le serveur SMTP existant est utilisé.

Appliquer une seule fois `migrations/202609270001-paypal-confirmation-email.sql` avant le déploiement (après la migration PayPal initiale). Les anciens paiements sont marqués pour ne pas déclencher d’envoi rétroactif.

La tentative d’envoi est enregistrée avant SMTP, sous le verrou de l’utilisateur, après validation des droits. Les webhooks répétés et actualisations ne renvoient pas l’email. `confirmationEmailSentAt` indique que SMTP a accepté l’envoi, sans garantir la réception en boîte de réception. Une tentative sans date d’envoi nécessite une vérification manuelle des journaux SMTP : aucun renvoi automatique, car un timeout peut survenir après acceptation. Un échec d’email ne retire pas Premium.
