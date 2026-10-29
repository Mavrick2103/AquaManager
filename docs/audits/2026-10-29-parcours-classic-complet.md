# Audit du parcours Classic après les dernières corrections

Date : 29 octobre 2026. Version locale : 1.5.10.

Périmètre : inscription et confirmation du compte, accueil, tutoriel, création d’aquarium, mesures, tâches, Solutions et préférences de notification. Lecture du code et contrôles locaux dans Chrome, notamment à 390 pixels de largeur. Cet audit ne constitue pas un test de production, de délivrabilité des emails, des paiements réels, ni une étude auprès d’utilisateurs débutants.

## Appréciation du parcours

La structure générale est désormais cohérente : la navigation commune donne accès à l’accueil, aux aquariums, à l’entretien et aux paramètres. La fiche regroupe le suivi du bac, et la distinction entre Bilan & actions inclus et IA Premium est visible. Le tutoriel présente l’essentiel en cinq étapes et utilise un exemple temporaire.

Les captures mobiles de la navigation et de Solutions ont été inspectées : les libellés sont lisibles et les actions principales sont identifiables. Les contrôles existants du tutoriel et des formulaires passent. La confirmation après inscription reste disponible pour expliquer la vérification email.

Le principal frein restant est la confiance dans le suivi : le même entretien doit avoir le même état partout, le bon aquarium doit rester sélectionné, et une panne ne doit pas être interprétée comme une absence de données.

| Étape | Constat |
| --- | --- |
| Inscription / connexion | Choix des notifications explicite et confirmation persistante ; parcours de confirmation rejoué avec réponses simulées. Livraison réelle de l’email non testée. |
| Première découverte | Tutoriel court, étapes Aquarium → Tâches → Solutions, actions atteignables dans les scénarios mobile et paysage. |
| Création du bac | Choix entre bac existant et nouveau bac compréhensible ; défaut confirmé sur la conversion de la date de mise en eau. |
| Mesures | Préremplissage annoncé et protection de la saisie lente vérifiés ; l’erreur de chargement de l’historique reste mal distinguée d’un historique vide. |
| Entretien | Calendrier fiabilisé, mais la liste de la fiche aquarium utilise encore les modèles de routine au lieu des occurrences ; perte du contexte du bac en ouvrant le planning. |
| Solutions | Séparation Classic / Premium plus claire ; une panne de récupération des recommandations peut afficher Aucune action en attente. |
| Paramètres | Rubriques identifiables ; les préférences non chargées restent enregistrables avec les valeurs par défaut. |

## 1. Priorité haute — une routine terminée dans la fiche reste à faire dans le calendrier

Reproduction navigateur : ouvrir l’onglet Tâches d’un aquarium contenant une routine hebdomadaire et la cocher. La fiche envoie un PATCH à `/tasks/41`, identifiant du modèle, et la présente ensuite comme terminée. Elle ne sélectionne pas une occurrence `r:41:…`.

Un test du service réel, avec dépôts simulés, confirme que ce modèle devient DONE tandis que ses occurrences générées dans le mois restent PENDING. La liste sans mois expose les modèles ; le calendrier mensuel développe les occurrences et utilise `completedOccurrences` pour leur statut.

Conséquence : un utilisateur peut croire son entretien enregistré comme réalisé dans un écran et le retrouver à faire dans un autre. Le résumé et l’historique de la fiche peuvent également donner une lecture différente du calendrier.

Correction recommandée : partager la logique d’occurrences du calendrier avec la fiche aquarium, choisir une fenêtre de suivi explicite, puis valider uniquement l’occurrence concernée. Ne pas traiter une routine comme un entretien unique terminé. Vérifier le même statut dans les deux écrans après rechargement.

Sources : `front_end/web/src/app/pages/aquariums/detail/tasks/aquarium-tasks.component.ts:62`, `:107` ; `back_end/src/tasks/task.service.ts:262`, `:302`, `:446`. Le chargement des impacts d’entretien dans `aquarium-detail.component.ts:1384` utilise aussi la liste sans mois et mérite la même harmonisation.

## 2. Priorité moyenne — Gérer le planning perd l’aquarium sélectionné

Reproduction navigateur : ouvrir le deuxième bac, entrer dans Tâches, cliquer sur Gérer le planning puis Nouvelle tâche. Le formulaire sélectionne le premier bac de la liste, et non le deuxième bac d’où vient l’utilisateur.

La navigation vers `/calendar` n’emporte aucun identifiant de bac. Le formulaire de tâche sait déjà recevoir un aquarium par défaut, mais ce parcours ne le lui transmet pas.

Conséquence : manipulation supplémentaire et risque de créer un entretien pour le mauvais aquarium si l’utilisateur se fie au contexte précédent. Aucun entretien réel n’a été créé pour constater ce défaut : la sélection du formulaire a été contrôlée.

Correction recommandée : conserver le bac dans le lien vers le planning, appliquer le filtre correspondant et le présélectionner dans Nouvelle tâche. Prévoir un libellé permettant de revenir à tous les aquariums.

Sources : `front_end/web/src/app/pages/aquariums/detail/tasks/aquarium-tasks.component.ts:139` ; `front_end/web/src/app/pages/calendar/calendar.component.ts`, `openCreate()` ; `task-dialog/task-dialog.component.ts`, sélection initiale de l’aquarium.

## 3. Priorité moyenne — la date de mise en eau peut reculer d’un jour

Le formulaire convertit la date choisie en ISO UTC puis garde uniquement la partie calendrier. En France, une date sélectionnée à minuit local peut donc devenir la veille en UTC.

Test ciblé du formulaire : la valeur correspondant au 16 octobre 2026 à 00:00 en heure de Paris (`2026-10-16T00:00:00+02:00`) entraîne un appel de création contenant `startDate: '2026-10-15'`.

Conséquence : la date enregistrée ne correspond pas au jour choisi, ce qui brouille les repères de démarrage du bac. La date de mise en eau est une date civile, pas un instant à convertir en UTC.

Correction recommandée : sérialiser l’année, le mois et le jour locaux pour ce champ de type date. Tester les heures de Paris d’été et d’hiver.

Source : `front_end/web/src/app/pages/aquariums/dialog/aquarium-dialog.component.ts:89`.

## 4. Priorité moyenne — une panne ressemble encore à des données absentes dans la fiche

Reproduction navigateur : répondre 503 au chargement initial des mesures et des recommandations. La fiche affiche Aucune mesure enregistrée ; l’onglet Solutions affiche Aucune action en attente. Un message temporaire de type snackbar prévient de l’erreur, mais les états vides restent visibles.

La liste des tâches de la fiche suit aussi ce schéma par lecture du code : elle vide son tableau sur erreur et présente ensuite Tout est à jour. Ce troisième écran n’a pas fait l’objet d’une reproduction dédiée ici.

Conséquence : l’utilisateur peut croire ses relevés disparus ou conclure qu’aucun entretien n’est nécessaire, alors que les informations sont indisponibles.

Correction recommandée : états distincts de chargement, erreur et liste vide pour mesures, recommandations et tâches de la fiche. Afficher une erreur persistante avec Réessayer et réserver les états vides à une réponse valide. Conserver les dernières données visibles, en les signalant comme non actualisées, si une actualisation échoue.

Sources : `front_end/web/src/app/pages/aquariums/detail/aquarium-detail.component.ts:829`, `:1364` ; template `:389`, `:1065` ; `tasks/aquarium-tasks.component.ts:68`.

## 5. Priorité haute — des préférences non chargées peuvent écraser les choix existants

Reproduction navigateur : répondre 503 à GET `/settings`, ouvrir Notifications et cliquer sur Enregistrer mes préférences. Le bouton reste actif et un PUT est envoyé avec les valeurs initiales du composant, notamment `notificationsEnabled: false`, `taskReminders: true` et `newsAndUpdates: false`.

Le problème n’est pas une modification automatique à l’ouverture : il nécessite un clic sur Enregistrer. Toutefois, les réglages affichés à ce moment ne reflètent pas les choix enregistrés de la personne. Une sauvegarde peut donc les remplacer sans qu’elle ait pu les consulter.

Correction recommandée : marquer les préférences comme non chargées ou en erreur, permettre de réessayer et bloquer la sauvegarde tant qu’une réponse valide n’a pas été reçue. Ajouter un avertissement de départ si des changements non enregistrés sont présents.

Sources : `front_end/web/src/app/pages/profile/profile.component.ts:143`, `:225`, `:242` ; `profile.component.html:435`.

## Améliorations de compréhension, distinctes des défauts

- Sur le petit écran inspecté, l’accueil commence par une présentation générale et des boutons de navigation ; les indicateurs utiles sont plus bas. Pour un utilisateur déjà inscrit, mettre sa prochaine action ou un bouton Ajouter une mesure plus haut rendrait le retour quotidien plus direct. Il s’agit d’une observation de présentation, pas d’une preuve d’amélioration de la fidélisation.
- Employer un vocabulaire plus constant entre Calendrier, Entretien et Tâches faciliterait l’apprentissage. La rubrique globale peut rester Entretien, avec Tâches et Calendrier comme vues clairement identifiées.
- Valider ensuite le parcours auprès de quelques débutants : créer un bac existant, saisir une mesure et retrouver l’entretien à effectuer, sans explication orale. Les tests automatisés ne prouvent pas à eux seuls que les libellés sont compris.

## Vérifications et limites

- 21 scénarios navigateur existants réussis : démarrage et confirmation d’inscription (4), tutoriel (4), Solutions (5), actions sur les séries (3), conservation de saisie et reprise après erreur (5).
- Quatre reproductions navigateur supplémentaires ont confirmé les défauts de routine, contexte du bac, états vides sur panne et enregistrement de préférences non chargées. Elles constataient volontairement les comportements défectueux.
- Le défaut de date est confirmé par un test du formulaire Angular. Le contrôle navigateur de ce cas a été interrompu par l’interaction avec la superposition du sélecteur de date ; il n’est pas présenté comme une soumission navigateur réussie. Le test ciblé utilise le même code de création et contrôle le payload reçu par le service simulé.
- Un test supplémentaire du service des tâches confirme la divergence modèle DONE / occurrences PENDING ; les quatre tests existants de portée des séries passent aussi.
- Les réponses API et les dépôts sont simulés. Aucun compte réel, aucune base de production, aucun paiement et aucun envoi d’email modifié.
- Les fichiers temporaires de reproduction ont été supprimés après vérification pour ne pas inscrire ces défauts comme comportements attendus dans la suite permanente.
- Aucun correctif applicatif appliqué pendant cet audit. Le serveur local de vérification a été arrêté à la fin.

Ordre conseillé : harmoniser les occurrences entre fiche et calendrier, protéger les préférences non chargées, conserver le contexte du bac, puis corriger la date civile et les états d’erreur de la fiche. La structure visuelle actuelle peut être conservée pendant ces corrections.

## Corrections appliquées après cet audit

Les cinq points sont corrigés dans le code local :

- La fiche aquarium charge les occurrences du mois consulté, comme le calendrier. Une navigation mensuelle permet de retrouver les entretiens précédents et suivants ; les compteurs et états vides sont explicitement limités au mois affiché. Cocher une routine modifie uniquement l’occurrence concernée. Le serveur refuse désormais aussi de terminer directement son modèle. Les repères d’entretien des mesures chargent les occurrences terminées sur la période des relevés, et sont actualisés après une modification dans la fiche.
- Gérer le planning transmet le bac, son nom et le mois consulté. Le calendrier les conserve, y compris lors de la création d’une nouvelle tâche depuis son bouton principal ou une journée. Le choix Tous les aquariums reste disponible.
- La date de mise en eau est sérialisée comme date civile locale, sans conversion UTC préalable. Un test couvre une date locale d’été et une date locale d’hiver.
- Les mesures, recommandations et tâches distinguent maintenant chargement, erreur et réponse vide. Des messages persistants proposent Réessayer. Après un échec d’actualisation des mesures déjà chargées, les anciennes données restent visibles avec un avertissement ; l’état vide initial n’est plus affiché à la place d’une erreur.
- Les préférences de notification sont cachées tant qu’elles ne sont pas connues. Après un échec de chargement, un bouton permet de réessayer et la méthode de sauvegarde refuse tout enregistrement tant que le chargement n’a pas réussi. Les préférences récupérées sont ensuite conservées lors de la sauvegarde.

L’accueil affiche également l’entretien prioritaire en haut : entretien à rattraper du mois courant, ou prochain entretien des sept jours à venir. Le bouton ouvre le bon bac et le bon mois, y compris au changement de mois. En l’absence de données disponibles, l’accueil conserve une invitation générale au suivi.

Validation : 67 tests unitaires frontend réussis ; 30 tests serveur ciblés réussis ; 32 scénarios navigateur réussis sur sept fichiers. Les six nouveaux scénarios ont été rejoués après la dernière retouche de présentation et passent également. Captures mobiles de l’accueil et de la fiche des tâches inspectées ; pas de débordement horizontal dans le contrôle ajouté. Compilations API et frontend réussies. Le premier build frontend avait dépassé le budget du style du détail aquarium ; la présentation du message d’erreur a été déplacée dans les styles partagés et le build suivant réussit. Des avertissements de taille CSS restent présents sur l’accueil et le détail aquarium.

Les tests navigateur utilisent des réponses API simulées. Aucun changement de données de production, aucun email envoyé et aucun paiement effectué. Aucune nouvelle migration nécessaire pour ces corrections. Le serveur de vérification a été arrêté après les contrôles.
