# Audit après fiabilisation des tâches

Date : 29 octobre 2026. Version affichée : 1.5.10. Audit local ciblé sur les derniers correctifs et sur la modification/suppression des tâches récurrentes. Aucun audit de production, paiement ou sécurité complet n’est revendiqué ici.

## Conclusion

Les quatre corrections du précédent audit tiennent dans les scénarios rejoués. Neuf contrôles navigateur existants passent, dont les validations masquées, les dates locales, la reprise après erreur, la conservation du préremplissage et les durées de routine.

Trois défauts supplémentaires sont confirmés. Les deux premiers portent sur la différence entre une occurrence et sa série et doivent être traités ensemble. Ils existaient dans le comportement de modification et de suppression ; les tests précédents de conservation de durée utilisaient une tâche de base, et ne prouvaient pas la stabilité de l’ensemble d’une série après édition d’une occurrence.

## 1. Priorité haute — modifier le titre d’une occurrence déplace le début et la fin de la série

La fenêtre initialise sa date avec celle de l’occurrence affichée, puis renvoie cette date et la durée complète à chaque enregistrement. Le serveur traite la référence virtuelle comme celle de la tâche de base pour ces champs, sans distinguer une modification d’occurrence d’une modification de série.

Exemple reproduit côté service : série hebdomadaire créée le 1er octobre 2026 à 09:00 UTC, limitée à douze semaines, fin initiale le 24 décembre. Renommer l’occurrence du 29 octobre avec le payload du formulaire remplace le début de la série par le 29 octobre et sa fin par le 21 janvier 2027. Les occurrences antérieures au nouveau début ne sont alors plus générées dans le calendrier. Cela ne démontre pas une suppression physique de toutes leurs données : le problème confirmé est la modification des bornes de la série.

Un scénario navigateur avec API simulée confirme que renommer une occurrence envoie bien sa date avec la durée complète. Un test du service réel, avec dépôts simulés, confirme le déplacement des bornes.

Correction recommandée : distinguer explicitement « cette occurrence » et « toute la série ». Pour une modification globale, conserver la date d’origine de la série tant que l’utilisateur ne l’a pas explicitement changée. Ne pas renvoyer la date d’une occurrence comme nouveau début pour un simple renommage. Tester le calendrier avant et après, ainsi que les occurrences déjà terminées.

Sources : `front_end/web/src/app/pages/calendar/day-tasks-dialog/task-detail-dialog/task-detail-dialog.component.ts:101`, `:260` ; `back_end/src/tasks/task.service.ts:440`, `:474`.

## 2. Priorité haute — supprimer une occurrence supprime toute la série sans l’indiquer

Depuis les détails d’une occurrence, la confirmation dit uniquement « Supprimer la tâche “Routine” ? ». La requête utilise la référence virtuelle de cette occurrence. Le serveur en extrait l’identifiant de base et appelle la suppression de cette tâche de base.

Reproduction confirmée : supprimer `r:41:2026-10-29T09:00:00.000Z` provoque `repo.delete(41)`. Il n’existe pas ici de traitement distinct pour supprimer seulement l’occurrence sélectionnée. Le scénario navigateur confirme la confirmation générique ; le test du service confirme la suppression du modèle de série.

Correction recommandée : proposer clairement la suppression de cette occurrence ou de toute la série. Si seule la suppression globale est disponible à court terme, le bouton et la confirmation doivent annoncer explicitement « Supprimer toute la série ». Une suppression isolée doit exclure l’occurrence sans supprimer son modèle.

Sources : `front_end/web/src/app/pages/calendar/day-tasks-dialog/task-detail-dialog/task-detail-dialog.component.ts:279` ; `back_end/src/tasks/task.service.ts:518`, `:527`.

## 3. Priorité moyenne — effacer une note ne supprime pas son ancien contenu

Reproduction : ouvrir une tâche contenant « Ancienne note », effacer entièrement la description et enregistrer. Le formulaire transforme la chaîne vide en `undefined`, donc le JSON ne contient plus le champ `description`. Le serveur traite l’absence du champ comme une demande de ne pas modifier la note et conserve l’ancien texte.

Le scénario navigateur confirme l’absence de `description` dans le PATCH après effacement ; le test du service confirme que l’ancienne valeur reste présente. Le comportement est commun aux tâches simples et récurrentes, puisque la construction du payload est identique.

Correction recommandée : envoyer une chaîne vide explicite, ou une autre valeur d’effacement acceptée par le contrat de l’API. Distinguer un champ non modifié d’un champ volontairement vidé, puis vérifier le résultat après rechargement.

Sources : `front_end/web/src/app/pages/calendar/day-tasks-dialog/task-detail-dialog/task-detail-dialog.component.ts:259` ; `back_end/src/tasks/task.service.ts`, branche `dto.description !== undefined`.

## Vérifications et limites

- Neuf scénarios navigateur de régression réussis : `task-recovery.cy.ts` (5) et `user-journey-edge-cases.cy.ts` (4).
- Douze tests existants du service des tâches réussis.
- Trois reproductions supplémentaires côté service et deux scénarios navigateur temporaires ont confirmé les trois défauts décrits. Ces tests constataient volontairement les comportements défectueux ; leur réussite ne signifie pas que ces défauts ont été corrigés.
- Les scénarios navigateur utilisent des réponses API simulées, et les tests serveur des dépôts simulés. Aucune base réelle ni aucun compte de production modifié.
- Les deux fichiers de reproduction temporaires ont été retirés après l’audit pour ne pas figer ces défauts comme résultats attendus des tests permanents.
- Aucun code applicatif modifié pendant cet audit. Serveur local de vérification arrêté à la fin.

La priorité est de fiabiliser la portée des actions sur les routines avant une nouvelle refonte visuelle. Les améliorations précédentes restent valables ; ce rapport ne prétend pas garantir l’absence de défauts dans les autres fonctionnalités de l’application.

## Corrections appliquées après cet audit

Les trois défauts sont corrigés dans le code local :

- Chaque occurrence transporte maintenant la date d’origine de sa série (`seriesDueAt`). La fenêtre affiche Modifier la série, annonce la portée globale, utilise la référence du modèle et conserve son début lors d’un simple renommage. Si les métadonnées manquent, la modification est bloquée avec une invitation à actualiser. Le serveur refuse aussi une modification de contenu directement adressée à un identifiant d’occurrence ; la validation du statut d’une occurrence reste autorisée.
- La suppression proposée est explicitement Supprimer toute la série. La confirmation annonce la disparition de toutes ses occurrences, y compris celles terminées. Une tentative directe de supprimer un identifiant d’occurrence est refusée par le serveur. La suppression isolée d’une occurrence n’est pas ajoutée dans cette correction.
- Une note volontairement effacée est envoyée comme chaîne vide et peut donc être supprimée réellement.

Le retrait administratif d’un accès offert a également été corrigé après le signalement de l’erreur 409 « Résilie d’abord l’abonnement PayPal pour retirer les droits ». Une offre manuelle peut conserver le marqueur d’une ancienne tentative PayPal abandonnée, notamment lorsqu’un accès a été accordé malgré un GET PayPal 404. Le retrait bloquait systématiquement sur ce marqueur. Il passe désormais par le même contrôle de paiement que l’attribution manuelle lorsque la source de l’accès est manuelle (`billingProvider` nul). Les abonnements gérés par PayPal restent protégés, et une vérification refusée n’effectue pas le retrait. Les références et protections PayPal ne sont pas effacées arbitrairement.

L’administration affiche maintenant l’erreur renvoyée et confirme un retrait réussi. Si le compte possède le rôle administrateur, le message précise que ce rôle conserve les fonctionnalités Pro, indépendamment de l’offre retirée.

Validation : 70 tests serveur ciblés réussis (57 sur tâches, utilisateurs et protection PayPal ; 13 sur contrôleur et parcours fonctionnels de tâches), 66 tests unitaires frontend réussis, 13 scénarios navigateur réussis. Les scénarios incluent l’envoi de la date d’origine, l’effacement d’une note, la confirmation de suppression globale et son annulation, les métadonnées manquantes, ainsi que l’erreur visible et le succès du retrait d’une offre. Compilations API et frontend réussies ; avertissements CSS préexistants inchangés. Aucun test sur un compte réel ou appel PayPal réel ; rien n’est déployé. Aucune nouvelle migration nécessaire pour ces corrections.
