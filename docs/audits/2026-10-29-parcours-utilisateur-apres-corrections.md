# Second audit du parcours utilisateur — après corrections

Date : 29 octobre 2026. Version locale de travail.

## Suivi : modifications appliquées après validation

Les constats ci-dessous décrivent l'état examiné avant ces modifications :

- Total des tâches séparé des cinq lignes affichées, exclusion des tâches terminées des compteurs « À faire », chargement des mois qui couvrent la fenêtre des sept jours. Compteur des retards explicitement limité au mois courant.
- Chargement et erreurs distingués des vrais états vides ; actions Réessayer pour les tâches, les mesures et le planning hebdomadaire.
- Planning hebdomadaire rechargé à chaque changement de semaine, y compris au changement de mois ; résultats obsolètes de requêtes ignorés.
- Confirmation d'inscription persistante sur la connexion, adresse préremplie, renvoi du lien et conservation après rechargement. L'adresse n'est pas placée dans l'URL.
- Choix entre aquarium existant et nouveau bac ; pas de cyclage sélectionné pour un aquarium existant.
- Formulaire d'entretien ordonné Aquarium → Type/titre → Date → Répétition → Notes, avec action de création d'aquarium dans l'état vide.
- Navigation commune ajoutée aux pages principales, avec accès à l'aide.

Ces modifications utilisent les données et API existantes et ne nécessitent pas de nouvelle migration. Les historiques de réalisation ne possédant pas de date effective d'achèvement, la liste « Entretiens terminés » annonce explicitement son classement par date prévue.

## Verdict

Le parcours principal est désormais cohérent : compte → aquarium → relevé → bilan → entretien. Mesures et Solutions sont plus explicites ; la progression n'interrompt plus l'accès aux activités utiles. Les paramètres et la distinction Classic/Premium sont compréhensibles dans les scénarios examinés.

Il reste des points de friction au démarrage et dans la création d'une tâche. Le principal problème découvert lors de cette seconde lecture est la fiabilité des informations d'entretien affichées sur l'accueil : elle doit être corrigée avant de considérer cet écran comme un résumé fiable du travail à faire.

Il n'est pas nécessaire de refaire tout le site. Il faut corriger ces points ciblés puis observer de vrais utilisateurs.

## Vérifications

- Relecture des écrans et enchaînements actuels, des données de l'accueil, des formulaires et de l'éligibilité au questionnaire.
- Nouvelle exécution Cypress sous Chrome : **35 tests réussis dans huit suites** : auth (2), aquariums (5), water (5), solutions (5), profile (6), site-tour (4), satisfaction (7), gamification (1).
- Contrôles de petit écran pour les mesures, les Solutions, le profil et le tutoriel ; paysage également testé pour le tutoriel. Inspection des captures mobiles Mesures/Solutions/Profil.
- Les API sont simulées dans ces tests : ce n'est pas une validation des emails réels, de PayPal en production ou du ressenti de vrais débutants.
- Les défauts de compteur ci-dessous sont confirmés par le code ; ils ne sont pas couverts par les assertions des tests existants, qui passent malgré ces défauts.
- Cet audit n'a pas modifié le fonctionnement de l'application.

## Corrections précédentes confirmées

| Point | État actuel |
|---|---|
| Préremplissage | Conservé conformément au souhait du propriétaire ; provenance et effet sur le nouveau relevé expliqués. |
| Bilan positif | Limité aux paramètres évaluables et récents ; plus de promesse de santé globale ou d'absence d'entretien. |
| Validation | Bornes du relevé alignées sur le serveur ; messages d'erreur dans les champs. |
| Accueil | Activités et calendrier avant les récompenses ; progression repliable. |
| Solutions | Présentation répétée retirée ; synthèse et actions plus proches du choix de l'assistant. |
| Première demande d'avis | Usage réel antérieur et retour un autre jour requis ; accès manuel conservé. Politique relue, test navigateur simulé, tests backend effectués lors de la correction précédente. |
| Mobile mesures | Notice visible à l'ouverture et boutons accessibles dans le petit format testé. |

## 1. Priorité haute — compteur des prochaines tâches incomplet

Sources : `front_end/web/src/app/pages/home/home.component.ts:115`, `:145`, `:153` et `front_end/web/src/app/pages/home/home.component.html:110`. Contrat serveur : `back_end/src/tasks/task.service.ts:279`.

### Constats confirmés

- L'accueil demande seulement les tâches du mois courant.
- Le tableau `upcomingTasks` est limité à cinq entrées.
- Le compteur « Tâches à venir (7j) » affiche la longueur de ce même tableau.
- Les filtres de l'accueil ne retirent pas les tâches déjà terminées du compteur du jour ou de la liste à venir.

### Exemples

- Huit tâches éligibles à venir donnent un compteur plafonné à cinq.
- À la fin d'un mois, les tâches du début du mois suivant ne sont pas chargées alors qu'elles peuvent appartenir aux sept prochains jours.
- Une tâche marquée terminée peut encore être présentée dans la liste à venir si son échéance est future.

### Conséquence

Le résumé peut ne pas correspondre au calendrier et ne permet pas de comprendre clairement ce qu'il reste à faire.

### Correction recommandée

Séparer le total du nombre de lignes affichées ; charger toute la période qui traverse éventuellement deux mois ; distinguer à faire/terminé et afficher les retards comme une catégorie explicite. Le titre des compteurs doit préciser ce qui est compté.

### Critères de validation

Huit tâches à faire donnent un total de huit et au plus cinq lignes avec accès à la suite. Une tâche prévue dans le prochain mois mais dans les sept jours est incluse. Une tâche terminée ne reste pas dans « À faire ».

## 2. Priorité haute — erreur réseau présentée comme absence d'entretien

Sources : `front_end/web/src/app/pages/home/home.component.ts:155` et `:175`, template `home.component.html:159`.

Si le chargement des tâches échoue, l'accueil affecte zéro au compteur et vide les listes. Il peut donc afficher « Aucune activité prévue dans les 7 jours ». Un échec du chargement des mesures produit également un compteur à zéro.

Ce n'est pas un état vide réel : l'information n'a pas pu être obtenue.

Correction recommandée : état « Impossible de charger » avec Réessayer, et compteur indisponible, sans affirmer qu'aucun entretien n'est prévu.

Validation : simuler une réponse serveur 503 et vérifier que ni zéro ni « Aucune activité prévue » ne sont utilisés comme résultat.

## 3. Priorité moyenne — inscription sans confirmation persistante

Source : `front_end/web/src/app/pages/register/register.component.ts:170`.

Après inscription, l'instruction de vérifier son email apparaît dans un message temporaire de 4,5 secondes puis l'utilisateur arrive sur l'écran de connexion ordinaire.

Risque à confirmer avec des débutants : manquer le message et ne pas comprendre pourquoi il faut encore activer son compte.

Recommandation : un état persistant « Consulte ta boîte mail pour activer ton compte », avec l'adresse concernée, une explication courte pour les indésirables et l'accès au renvoi du lien. Aucun besoin de rallonger le formulaire.

Validation : même après plusieurs secondes, la prochaine étape reste explicite.

## 4. Priorité moyenne — parcours ambigu pour un aquarium déjà en eau

Sources : `front_end/web/src/app/pages/aquariums/dialog/aquarium-dialog.component.ts:51`, template `:63`, et `pages/aquariums/aquariums.component.ts:91`.

Le protocole de cyclage est proposé avec une case cochée par défaut, y compris lors de la saisie d'un bac ancien. Si le choix reste coché, la navigation mène au protocole de démarrage. Cela ne prouve pas qu'un protocole est automatiquement appliqué : les étapes sont ensuite à vérifier.

Risque : une personne vient suivre son bac existant mais pense devoir recommencer le parcours d'un nouveau bac.

Recommandation : expliciter le choix « Nouveau bac en démarrage » / « Aquarium déjà en fonctionnement », ou rendre l'option non cochée pour une ancienne mise en eau. Conserver la validation des étapes avant leur ajout au planning.

## 5. Priorité moyenne — création d'une tâche encore trop exigeante

Source : `front_end/web/src/app/pages/calendar/task-dialog/task-dialog.component.html:24`.

Le titre arrive avant le type, alors que le type peut générer et verrouiller ce titre. L'aquarium se choisit après la date et l'heure. L'état sans aquarium explique le problème mais ne propose pas de bouton pour le résoudre sur place.

Recommandation : Aquarium → Type → Date → Répétition facultative → Notes. Afficher le titre généré comme un résultat du choix du type ; garder une saisie libre pour une tâche personnalisée. Depuis un bac, conserver sa présélection. Ajouter une action pour créer un aquarium lorsqu'il n'y en a aucun.

Validation : une personne planifie son prochain entretien sans remplir un titre qui sera ensuite remplacé.

## 6. Priorité basse — orientation entre les pages et vocabulaire

- La navigation globale reste différente selon l'écran. Des accès explicites et constants à Aquariums, Entretien et Paramètres réduiraient le besoin de revenir par le logo.
- « Protocoles » mérite une aide courte ou un libellé plus parlant pour un débutant. « Habitants » serait plus précis que « Dans mon Aquarium ».
- Le passage entre tu et vous reste visible.
- Le formulaire de relevé reste dense. Une section avancée repliable est une piste à tester, en garantissant que les paramètres déjà préremplis restent identifiables.
- Le tutoriel peut être relancé par un lien de pied de page, mais cet accès reste éloigné du haut du tableau de bord.

Ces points sont des améliorations de compréhension à tester, pas des erreurs techniques démontrées par les scénarios navigateur.

## Lecture du parcours par étape

| Étape | Appréciation actuelle | Travail restant |
|---|---|---|
| Comprendre la promesse | Claire | Tester la compréhension de la valeur Premium. |
| Créer et activer son compte | Compréhensible mais étape email peu persistante | Confirmation visible après inscription. |
| Comprendre l'essentiel avec le tutoriel | Court et cohérent | Observer le transfert vers le vrai aquarium. |
| Créer son premier bac | Guidé | Distinguer démarrage et bac existant. |
| Ajouter un relevé | Plus explicite, rapide par préremplissage | Réduire la densité sans masquer les valeurs conservées. |
| Lire les Solutions | Nettement plus direct | Vérifier avec des débutants la compréhension des limites du bilan. |
| Prévoir un entretien | Fonctionnel, formulaire perfectible | Réordonner les choix. |
| Revenir savoir quoi faire | Accès plus direct mais résumé encore imparfait | Corriger les compteurs et les erreurs de chargement en premier. |
| Gérer compte et abonnement | Rubriques distinctes | Garder une navigation cohérente. |

## Prochaine validation utile

Corriger d'abord les deux défauts du résumé d'accueil. Faire ensuite tester à cinq aquariophiles sur téléphone : activation du compte, ajout d'un bac déjà en eau, saisie d'un relevé partiel, planification d'un entretien, interprétation du bilan et retour aux tâches. Mesurer l'aide nécessaire et la compréhension du résultat, pas seulement les clics réussis.

Le nombre de tests réussis confirme des comportements techniques ; il ne permet pas de conclure que tous les utilisateurs trouveront le parcours intuitif.
