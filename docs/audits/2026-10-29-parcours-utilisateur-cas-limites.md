# Troisième audit du parcours utilisateur — cas limites

Date : 29 octobre 2026. Application locale après les améliorations du deuxième audit.

## Conclusion

L'organisation principale est cohérente et ne nécessite pas une nouvelle refonte. Les accès communs, la confirmation email persistante, le choix du type de bac et le résumé d'entretien ont amélioré les premières étapes.

La fiabilité n'est toutefois pas complète : des changements de choix dans le formulaire d'entretien peuvent bloquer l'enregistrement sans erreur visible. Le calendrier mensuel conserve une incohérence de date avec les vues utilisant l'heure locale. La liste des aquariums ne gère pas correctement un échec initial de chargement.

## Méthode et limites

- Relecture des parcours, des branchements conditionnels, des validations et du chargement des données.
- Réexécution des neuf suites Cypress du parcours utilisateur : auth, aquariums, water, solutions, profile, site-tour, satisfaction, gamification et user-journey-improvements.
- Résultat de cette exécution : **39 scénarios navigateur réussis**. Les trois défauts reproduits séparément ne sont pas couverts par ces scénarios habituels.
- Reproduction isolée de trois défauts avec Angular TestBed et des données simulées : changement de type après fertilisation, annulation d'une répétition, regroupement du calendrier autour de minuit. Les trois sondes ont confirmé les comportements décrits. Elles ont été retirées pour ne pas transformer les défauts en comportements attendus dans les tests permanents.
- Les tests navigateur ordinaires peuvent réussir sans couvrir ces changements de choix : leur réussite ne signifie pas absence de défauts.
- Pas de test de paiement réel ni de délivrabilité email ; pas d'observation de nouveaux utilisateurs humains ; aucune validation de production.
- Aucun fonctionnement de l'application modifié pendant cet audit.

## 1. Priorité haute — une ligne d'engrais cachée peut bloquer une autre tâche

**Reproduction confirmée avec le composant réel sous TestBed.**

1. Ouvrir une nouvelle tâche avec un aquarium disponible.
2. Choisir « Fertilisation » : une ligne d'engrais est créée avec un nom vide obligatoire.
3. Sans compléter cette ligne, choisir « Changement d'eau ».
4. Le titre est correctement généré et la section engrais disparaît, mais le tableau de contrôles `fertilizers` reste activé et invalide.
5. `save()` s'arrête sur `form.invalid`. L'utilisateur ne voit plus le champ à corriger.

**Correction attendue :** désactiver les contrôles de fertilisation lorsque le type n'est plus Fertilisation, ou ajuster leurs validations. Lors du retour à Fertilisation, réactiver la validation et conserver éventuellement la saisie. Le contenu non applicable ne doit pas bloquer l'enregistrement.

Sources : `front_end/web/src/app/pages/calendar/task-dialog/task-dialog.component.ts:222`, `:290`, `:374` ; template `:196`.

## 2. Priorité moyenne — annuler une répétition ne désactive pas tous ses champs

**Reproduction confirmée avec le composant réel sous TestBed.**

1. Choisir une tâche valide.
2. Activer la répétition, puis sa date de fin/durée.
3. Saisir une durée invalide, par exemple zéro semaine.
4. Dans Fréquence, sélectionner « Aucune ».
5. Le code passe `isRepeat` à faux avec `emitEvent: false`. Le gestionnaire qui désactive la durée ne s'exécute pas. La durée invalide reste activée alors que sa section est cachée.

**Correction attendue :** centraliser l'activation des contrôles de répétition. Choisir Aucune doit aboutir au même état que désactiver explicitement le bouton Tâche répétitive : durée, fin et intervalle inutilisés désactivés.

Sources : `front_end/web/src/app/pages/calendar/task-dialog/task-dialog.component.ts:234`, `:274` ; template `:134`.

## 3. Priorité haute — calendrier mensuel : date UTC différente du jour affiché

**Reproduction confirmée par un test du regroupement réel.**

Le planning hebdomadaire utilise maintenant la date locale, mais le calendrier mensuel et son filtre Aujourd'hui comparent encore le préfixe `YYYY-MM-DD` de la chaîne UTC via `startsWith`.

Exemple : `2026-10-28T23:30:00Z` correspond au **29 octobre à 00:30 en France métropolitaine**. La vue mensuelle peut classer cette tâche au 28, tandis que son heure affichée ou le planning hebdomadaire la place au 29.

**Correction attendue :** utiliser la même règle de jour civil dans les vues, filtres et compteurs. Inclure également les limites des mois UTC lorsque le mois local chevauche cette frontière. Le choix du fuseau doit rester explicite et cohérent.

Sources : `front_end/web/src/app/pages/calendar/calendar.component.ts:182`, `:195`, `:227` ; comparaison avec `pages/home/week-calendar.component.ts`.

## 4. Priorité haute — erreur de chargement initial des aquariums non présentée

**Confirmé par lecture des branches du code ; pas de reproduction de l'écran en panne dans les tests navigateur de cet audit.**

La liste initialise `items` à vide. Son chargement utilise `Promise.all` avec un `finally` qui retire le chargement, sans état d'erreur ni récupération dans `load()`. Si l'overview, le compte ou le statut de conservation échoue, l'utilisateur peut être présenté comme n'ayant aucun aquarium et voir l'invitation à créer son premier bac, au lieu d'une erreur explicite.

Le problème d'état vide a été corrigé pour les données de l'accueil, mais pas pour cette autre page.

**Correction attendue :** traiter l'erreur, afficher Réessayer, masquer l'état « Premier aquarium » tant qu'une réponse valide n'a pas confirmé une liste vide. Éviter aussi d'afficher un quota par défaut comme s'il était connu pendant une panne.

Sources : `front_end/web/src/app/pages/aquariums/aquariums.component.ts:42`, `:58` ; template `:25`, `:225`.

## 5. Autres points à harmoniser

- Le compteur « 7 prochains jours » du calendrier mensuel utilise les tâches du mois sélectionné et une référence à aujourd'hui. Il ne faut pas le confondre avec le résumé de l'accueil qui charge désormais toute la fenêtre nécessaire. Clarifier le périmètre ou employer une source commune.
- Le chargement du calendrier mensuel n'a pas de protection contre les réponses arrivant dans le désordre après plusieurs changements de mois rapides ; le planning hebdomadaire a cette protection.
- La vue hebdomadaire n'indique pas clairement dans ses lignes si un entretien est déjà terminé. Ce n'est pas un défaut de compteur, mais une information d'usage à rendre visible.
- Le formulaire sans aquarium propose maintenant une action utile vers les aquariums. En cas d'erreur réseau, il demande encore de fermer la fenêtre pour réessayer : une reprise sur place serait plus confortable.

Ces points supplémentaires sont issus de la lecture du code ; ils n'ont pas tous fait l'objet d'une reproduction navigateur dédiée.

## Ordre conseillé

1. Éliminer les validations invisibles du formulaire d'entretien, en traitant ensemble Fertilisation et Répétition.
2. Harmoniser les dates et le périmètre des compteurs entre calendrier mensuel et résumé.
3. Étendre les états de chargement/erreur fiables à la liste des aquariums.
4. Tester ensuite le parcours avec de vrais débutants, sans leur expliquer où cliquer.

Les améliorations de présentation précédentes restent utiles. Les travaux recommandés ici concernent surtout la fiabilité des interactions et la cohérence entre écrans.

## Suivi des corrections — 29 octobre 2026

Les quatre défauts principaux décrits ci-dessus sont corrigés dans le code local :

- Les lignes d’engrais masquées sont désactivées : elles ne bloquent plus une autre catégorie de tâche. Leur saisie est conservée et de nouveau validée au retour sur Fertilisation.
- Les contrôles de répétition sont activés uniquement quand ils s’appliquent. Choisir Aucune retire les validations invisibles et enregistre une tâche sans répétition.
- Le calendrier regroupe et filtre les tâches selon le jour local du navigateur, comme la vue hebdomadaire. Le chargement couvre les mois UTC nécessaires aux frontières du mois local. Le résumé utilise une fenêtre indépendante du mois consulté, et les réponses obsolètes sont ignorées. Réessayer conserve le mois sélectionné.
- Une panne de chargement des aquariums affiche une erreur et Réessayer. L’état Premier aquarium et la création restent masqués ou désactivés jusqu’à une réponse valide.

Les tâches terminées sont également barrées et marquées Fait dans le planning hebdomadaire. Les compteurs de retard de l’accueil et du calendrier utilisent la même règle : échéance passée, tâche en attente, dans le mois courant.

Validation : 65 tests unitaires Angular réussis ; 17 scénarios Cypress réussis sur les quatre fichiers ciblés (cas limites, améliorations du parcours, aquariums et tutoriel). Deux erreurs du nouveau test navigateur ont été corrigées : ciblage de l’interrupteur Material et simulation manquante du statut de conservation. Les quatre cas limites passent après cette correction. Compilation de production réussie ; avertissements de taille CSS existants sur l’accueil et le détail aquarium.

Limites : les parcours navigateur utilisent des réponses API simulées ; aucun déploiement ni changement de données de production n’a été réalisé. L’amélioration de confort consistant à réessayer le chargement des aquariums directement dans le formulaire de tâche reste distincte : ce formulaire demande encore de le fermer pour réessayer.
