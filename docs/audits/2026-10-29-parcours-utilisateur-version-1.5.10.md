# Audit du parcours utilisateur — version 1.5.10

Date : 29 octobre 2026. Périmètre : code local, création et modification des tâches, calendrier, mesures et Solutions, avec contrôles navigateur sur écran mobile. Cet audit n’est ni un test de production ni un audit complet de sécurité.

## Bilan

Les corrections précédentes tiennent sur les scénarios rejoués : changement de catégorie après une fertilisation incomplète, annulation d’une répétition invalide, classement au jour local, résumé au changement de mois et récupération après une panne de la liste des aquariums. Les parcours habituels de mesure et de Solutions passent également.

Quatre défauts restent confirmés par reproduction navigateur. Ils concernent principalement la conservation de la saisie et la modification des tâches, plutôt que l’organisation générale des pages.

## 1. Priorité haute — une routine indéfinie devient limitée à quatre semaines lors d’une modification

Reproduction : ouvrir une tâche hebdomadaire dont `repeat.durationWeeks` est absent, changer uniquement son titre, puis enregistrer. La requête PATCH contient désormais `repeat.durationWeeks: 4`.

Le formulaire de détail initialise la durée absente à quatre semaines et l’envoie systématiquement. Le serveur interprète cette durée et recalcule la fin de répétition. Une routine créée sans fin peut donc s’arrêter après une modification sans rapport avec sa répétition.

Correction recommandée : proposer aussi dans le formulaire de modification le choix entre répétition sans fin et avec fin, préserver ce choix lors du chargement et n’envoyer une durée que lorsqu’elle a été choisie. Vérifier également l’édition depuis une occurrence d’une série.

Sources : `front_end/web/src/app/pages/calendar/day-tasks-dialog/task-detail-dialog/task-detail-dialog.component.ts:114`, `:183` ; `back_end/src/tasks/task.service.ts:473`.

## 2. Priorité haute — le préremplissage peut écraser une mesure en cours de saisie

Reproduction : retarder de 2,5 secondes la réponse contenant le relevé précédent, ouvrir Nouvelle mesure, saisir un pH de 8 avant son arrivée. À la réception de la réponse, le champ revient à 7, valeur de l’ancien relevé.

Les champs restent éditables pendant le chargement, puis un `patchValue` applique toutes les anciennes valeurs. Le bouton Enregistrer est bloqué pendant l’attente, mais cela ne protège pas les valeurs déjà tapées. Un utilisateur peut donc enregistrer ensuite une valeur différente de celle qu’il venait de saisir.

Correction recommandée : conserver le préremplissage voulu, mais remplir uniquement les champs que l’utilisateur n’a pas modifiés, ou empêcher explicitement la saisie pendant ce chargement. Préférer la conservation de toute saisie déjà commencée.

Sources : `front_end/web/src/app/pages/aquariums/detail/measurement-dialog.component.ts:91`, `:128` ; template associé, champs de mesure et bouton Enregistrer.

## 3. Priorité moyenne — une panne lors de la création d’une tâche fait perdre le formulaire

Reproduction : saisir une tâche, simuler une réponse 503 à la création, puis enregistrer. La fenêtre se ferme, une alerte indique l’échec. En ouvrant à nouveau Nouvelle tâche, le titre est vide.

Le formulaire renvoie son contenu en fermant la fenêtre avant que le calendrier ne lance la sauvegarde. L’erreur est donc signalée alors que la saisie n’est plus accessible. Cela impose de recommencer, notamment pour une tâche détaillée avec engrais et répétition.

Correction recommandée : attendre la réussite de l’enregistrement avant de fermer la fenêtre ; afficher l’erreur dans celle-ci et conserver les champs pour un nouvel essai. Appliquer la même règle au bouton Ajouter depuis la liste d’une journée.

Sources : `front_end/web/src/app/pages/calendar/task-dialog/task-dialog.component.ts:366` ; `front_end/web/src/app/pages/calendar/calendar.component.ts:138` ; `front_end/web/src/app/pages/calendar/day-tasks-dialog/day-tasks-dialog.component.ts:64`.

## 4. Priorité moyenne — Terminer une tâche peut échouer sans explication visible

Reproduction : afficher les tâches en liste, simuler une réponse 503 au PATCH, puis cliquer sur le bouton de validation. La tâche reste en attente et le bouton redevient disponible, sans alerte ni message dans la page.

La branche d’erreur écrit uniquement dans la console. L’utilisateur ne sait pas si son clic a été pris en compte ou si la sauvegarde a échoué. Le problème concerne aussi le bouton de la grille mensuelle qui utilise la même méthode.

Correction recommandée : afficher un message explicite, conserver l’état initial et permettre de réessayer. Donner aussi un nom accessible au bouton de validation de la vue liste ; dans la grille, adapter son libellé lorsque la tâche est déjà terminée.

Sources : `front_end/web/src/app/pages/calendar/calendar.component.ts:294` ; `front_end/web/src/app/pages/calendar/calendar.component.html:174`.

## Points de confort secondaires

- Dans la création d’une tâche, un échec de chargement des aquariums demande encore de fermer la fenêtre pour réessayer. Un bouton sur place éviterait cette manipulation.
- Le résumé En retard conserve les filtres d’aquarium et de type déjà choisis, tandis qu’À faire aujourd’hui les réinitialise. Harmoniser cette interaction ou expliciter le périmètre pour éviter qu’un compteur global mène à une liste filtrée vide. Observation par lecture du code, sans reproduction dédiée.

## Vérification et limites

- 14 scénarios existants réussis : 4 cas limites du parcours, 5 Solutions, 5 mesures et graphiques.
- 4 reproductions supplémentaires confirmées dans Chrome à une largeur de 390 pixels. Ces scénarios constataient volontairement les comportements défectueux décrits ci-dessus ; leur réussite ne signifie pas que les défauts sont corrigés.
- Le premier passage du scénario de panne de création vérifiait l’alerte trop tôt. Après ajout d’une attente sur l’alerte, les quatre reproductions aboutissent.
- Les tests Solutions et mesures contrôlent aussi les petits écrans, notamment l’absence de débordement horizontal et l’accès aux actions. Cela ne remplace pas un essai sur un téléphone physique.
- Réponses API simulées : aucune donnée utilisateur réelle modifiée, aucun paiement testé, aucun email envoyé.
- Aucun code de l’application corrigé pendant cet audit. Le fichier temporaire de reproduction a été retiré après vérification pour ne pas inscrire des comportements défectueux comme résultats attendus de la suite de tests.

Ordre conseillé : préserver la répétition indéfinie et la saisie des mesures, puis fiabiliser la sauvegarde et les retours d’erreur des tâches. Les corrections actuelles de navigation restent pertinentes ; une nouvelle refonte visuelle générale n’est pas nécessaire pour traiter ces quatre défauts.

## Corrections appliquées après cet audit

Les quatre défauts principaux sont corrigés dans le code local :

- Le détail d’une tâche propose une fin de répétition facultative et conserve les durées existantes. Une routine indéfinie n’acquiert plus de limite de quatre semaines lors d’un changement de titre.
- Le préremplissage applique les anciennes valeurs uniquement aux champs restés intacts. Une valeur saisie ou volontairement effacée reste inchangée, même si la réponse arrive plus tard.
- La fenêtre de création réalise elle-même la sauvegarde et se ferme uniquement après son succès. Pendant la requête, les doubles envois et la fermeture sont bloqués. En cas d’échec, elle conserve la saisie et affiche un message permettant de réessayer. Les deux points d’entrée du calendrier utilisent cette même sauvegarde, sans second envoi après fermeture.
- Un échec du bouton de validation de tâche affiche une erreur dans la page, conserve l’état initial et permet un nouvel essai. Les boutons ont un libellé accessible adapté à l’état de la tâche.

Le raccourci En retard réinitialise désormais les filtres comme À faire aujourd’hui. Le confort de reprise du chargement des aquariums dans le formulaire reste un point secondaire distinct.

Validation après correction : 66 tests unitaires réussis et 23 scénarios navigateur réussis sur cinq fichiers, dont cinq nouveaux contrôles de conservation de saisie, durée et récupération après erreur. La nouvelle vérification couvre notamment une routine indéfinie et une routine de douze semaines, le nouvel essai après échec de création, le nouvel essai après échec de validation et le préremplissage lent. Capture mobile du formulaire de mesure inspectée : actions accessibles. Compilation de production réussie, avec les avertissements de taille CSS préexistants sur l’accueil et le détail aquarium. Tests navigateur avec API simulée ; aucune modification de données de production. Aucune nouvelle migration nécessaire pour ces corrections.
