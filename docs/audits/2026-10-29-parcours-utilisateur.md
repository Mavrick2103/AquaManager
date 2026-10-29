# Audit du parcours utilisateur AquaManager — 29 octobre 2026

## Suivi des corrections validées par le propriétaire

Les constats ci-dessous décrivent l'état au moment de l'audit. Les corrections suivantes ont ensuite été appliquées localement :

- Préremplissage conservé à la demande du propriétaire, avec date du relevé source et explication des valeurs réenregistrées. Le focus initial reste sur la fenêtre pour ne pas masquer cette information.
- Bilan limité aux paramètres effectivement évaluables, avec exclusion des relevés anciens, invalides ou futurs de l'état positif. Aucune promesse de santé globale ni « Rien à faire ».
- Bornes du formulaire harmonisées avec l'API et messages au niveau des champs des formulaires de mesure et de création d'aquarium.
- Tâches et activités placées avant la progression ; missions et badges conservés dans un bloc dépliable.
- Présentation répétée de l'assistant supprimée : accès direct à la synthèse et aux actions.
- Première invitation automatique aux avis conditionnée à une mesure ou une tâche réelle enregistrée avant le jour UTC courant et à des visites sur au moins deux jours distincts. Le délai d'un mois entre réponses et l'accès manuel restent inchangés. Les utilisateurs ayant déjà répondu conservent leur cadence mensuelle.

Aucune nouvelle colonne ou migration n'est nécessaire pour ces corrections. La migration du compteur de fermetures d'avis est un changement distinct, à déployer si ce n'est pas encore fait.

## Conclusion

Les fonctions essentielles sont présentes et les parcours navigateur sélectionnés fonctionnent. Le parcours n'est toutefois pas encore uniformément simple pour un débutant. Les principaux risques concernent la fiabilité perçue des mesures et du bilan, la place donnée aux actions utiles et le nombre d'interruptions au premier démarrage.

Priorité : fiabiliser ce que l'utilisateur enregistre et comprend, puis simplifier les écrans existants. Cet audit ne recommande pas d'ajouter de nouvelles grandes fonctionnalités.

## Périmètre et méthode

- Code local : accueil public, inscription, connexion, vérification email, tableau de bord, liste et création des aquariums, mesures, tâches, calendrier, Solutions, tutoriel, profil et abonnement, demande d'avis.
- Exécution des six suites Cypress auth, aquariums, water, solutions, profile et site-tour : **22 tests réussis sur Chrome**.
- Parcours navigateur avec réponses API simulées : aucune inscription, transaction PayPal ou émission d'email réelle.
- Lecture du rendu mobile Solutions et des captures produites par les tests ; contrôles de petit écran et paysage inclus dans les tests du tutoriel.
- L'inscription et l'email ont été examinés dans le code ; la délivrabilité des emails et le parcours PayPal réel n'ont pas été vérifiés.
- Il s'agit d'un audit expert du parcours local, pas d'une observation d'utilisateurs réels ni d'une validation de la production. Les effets sur l'abandon et la conversion restent des hypothèses à mesurer.
- Aucun comportement de l'application modifié pendant cet audit.

## Points solides à conserver

1. L'accueil annonce clairement la gestion de l'aquarium et l'accès Classic gratuit, avec un appel à créer son compte.
2. La liste vide des aquariums donne une prochaine action explicite : créer son premier aquarium.
3. Le volume est calculé à partir des dimensions ; cela évite une saisie supplémentaire.
4. La fiche aquarium regroupe mesures, tâches et Solutions dans un même contexte.
5. Le calendrier distingue aujourd'hui, retard et prochains jours, avec filtres et vue liste.
6. Les Solutions distinguent le bilan inclus de l'IA Premium ; découvrir Premium reste possible sans lancer une analyse payante.
7. Le tutoriel est désormais court, interactif, sans formulaire à remplir ni données réelles créées.
8. Le profil sépare les rubriques du compte et de l'abonnement ; des tests couvrent aussi la résiliation.

## Constats prioritaires

### 1. Priorité haute — anciennes mesures reprises silencieusement

**Constat confirmé dans le code :** la fenêtre d'ajout charge la dernière mesure puis remplit les champs avec ses valeurs. L'enregistrement envoie les valeurs ainsi reprises avec la nouvelle date. Le formulaire ne distingue pas une ancienne valeur d'une valeur réellement retestée.

**Exemple :** une personne vient noter uniquement sa température. Les anciens NO2, NO3, GH, etc. peuvent être enregistrés à nouveau sans avoir été mesurés.

**Conséquence possible :** historique trompeur, bilan trop rassurant, perte de confiance.

**Modification recommandée :** laisser les champs vides et montrer les précédentes valeurs en aide non enregistrable. Toute reprise volontaire doit être explicite ; seules les valeurs confirmées comme mesurées sont enregistrées.

**Validation attendue :** renseigner uniquement la température produit une mesure contenant uniquement cette valeur, sans recopier les autres paramètres.

Sources : `front_end/web/src/app/pages/aquariums/detail/measurement-dialog.component.ts:89`, `:126`, `:142`.

### 2. Priorité haute — le bilan affirme davantage que les données ne permettent

**Constat confirmé dans le code :** `isTankHealthy` devient vrai lorsqu'une mesure existe, que les références sont chargées, qu'aucune recommandation n'est présente et qu'aucun paramètre renseigné ne sort des plages. Les valeurs absentes sont ignorées. Ce calcul ne vérifie ni l'ancienneté de la mesure ni un minimum de paramètres évaluables.

**Affichage actuel :** « Bac en bonne santé » et « Rien à faire ».

**Conséquence possible :** une mesure partielle ou ancienne semble constituer un diagnostic global et annuler tout besoin d'entretien.

**Modification recommandée :** « Aucun écart détecté parmi les paramètres évalués », avec date de la mesure et nombre de paramètres évaluables. Distinguer « données insuffisantes », « mesure ancienne » et « aucun écart détecté ». Ne pas assimiler l'absence d'écart à l'absence de tâches.

**Validation attendue :** une mesure sans paramètre évaluable ne déclenche aucun état positif ; une mesure ancienne est signalée ; les tâches restent visibles indépendamment du bilan.

Sources : `front_end/web/src/app/pages/aquariums/detail/aquarium-detail.component.ts:1690`, `:1734` ; template `:1006` et `:1009`.

### 3. Priorité haute — règles de saisie différentes entre écran et serveur

**Constat confirmé :** le formulaire accepte une température jusqu'à 45, un dKH jusqu'à 25, un calcium jusqu'à 700 et un magnésium jusqu'à 2000. Le serveur limite respectivement à 40, 20, 600 et 1800.

**Conséquence :** une saisie peut sembler valide puis être refusée après avoir appuyé sur Enregistrer. Le problème porte sur la cohérence des validations, pas sur la pertinence aquariophile de ces bornes.

**Modification recommandée :** harmoniser les règles et afficher une erreur explicite au champ concerné. Les formulaires de création d'aquarium et de mesure ne présentent actuellement pas de `mat-error` pour guider les corrections.

**Validation attendue :** aucune valeur validée par le formulaire n'est rejetée pour une borne différente côté serveur ; le message explique clairement comment corriger.

Sources : `front_end/web/src/app/pages/aquariums/detail/measurement-dialog.component.ts:58`, `:73` ; `back_end/src/water-measurement/dto/create-water-measurement.dto.ts:8`, `:21`.

### 4. Priorité moyenne — tableau de bord centré sur la progression avant l'entretien

**Constat confirmé dans la structure de l'écran :** après l'introduction viennent le grand bloc de progression, les badges et les missions. Les tâches du jour et les activités à venir apparaissent ensuite.

**Risque d'usage :** l'utilisateur régulier doit parcourir des récompenses avant de retrouver ce qu'il vient faire pour son aquarium.

**Modification recommandée :** remonter les tâches du jour/retards et l'accès aux bacs ; réduire la progression à un résumé secondaire dépliable. Pour un nouveau compte, proposer d'abord « Créer mon premier aquarium ».

**Validation attendue :** sur téléphone, la première zone utile permet d'identifier la prochaine action sans traverser les badges ou missions.

Source : `front_end/web/src/app/pages/home/home.component.html:98` et `:334`.

### 5. Priorité moyenne — demande d'avis trop tôt dans l'expérience

**Constat confirmé :** la politique d'éligibilité ne demande aucune expérience minimale. Au premier passage éligible, la fenêtre peut s'ouvrir. Le composant global est masqué pendant le tutoriel puis peut être monté dès sa fermeture, si aucune invitation n'a encore été consommée.

**Risque d'usage :** après une visite d'exemple, la personne est sollicitée pour évaluer une application qu'elle n'a pas encore utilisée pour son vrai bac.

**Modification recommandée :** conserver le délai d'un mois entre réponses, mais déclencher la première invitation après un usage réel et un retour ultérieur ; éviter toute ouverture pendant une saisie. Le choix exact du seuil reste à valider selon les usages.

**Validation attendue :** aucun questionnaire à la sortie du premier tutoriel avant une première action réelle ; accès manuel aux avis conservé dans les paramètres.

Sources : `back_end/src/satisfaction/satisfaction.policy.ts:54` ; `front_end/web/src/app/app.html:8` ; `front_end/web/src/app/shared/satisfaction/satisfaction.component.ts:44`.

### 6. Priorité moyenne — formulaire de mesure dense et peu explicite

**Constat confirmé :** les paramètres communs et tous ceux du type d'eau sont affichés ensemble. Le commentaire est explicitement facultatif, mais l'écran n'explique pas que les paramètres d'eau sont aussi facultatifs. Les acronymes ne sont pas accompagnés d'aide.

**Risque d'usage :** un débutant peut croire qu'il faut posséder tous les tests ou remplir toute la fenêtre avant de commencer.

**Modification recommandée :** une consigne courte « Renseigne uniquement ce que tu as mesuré », puis une section de paramètres courants et une section avancée repliable adaptée au type d'eau. Une aide courte à la demande pour les acronymes, sans ajouter un pavé permanent.

**Validation attendue :** une personne peut comprendre et enregistrer un relevé partiel sans chercher quelles cases sont obligatoires.

Source : `front_end/web/src/app/pages/aquariums/detail/measurement-dialog.component.html:25`.

### 7. Priorité moyenne — Solutions accumule des introductions avant le résultat

**Constat visible sur la capture mobile :** titre général, texte d'introduction, choix entre deux assistants, nouveau titre de l'assistant, description, badges de fonctions et bouton d'actualisation précèdent le bilan.

**Risque d'usage :** l'utilisateur doit faire défiler plusieurs explications pour découvrir si quelque chose mérite son attention.

**Modification recommandée :** conserver les deux choix « Bilan & actions » / « Demander à l'IA », puis présenter directement date, synthèse et actions. Garder un bouton d'actualisation discret ; réduire le bloc de présentation répété.

**Validation attendue :** le premier résultat, ou l'invitation à saisir une première mesure, apparaît rapidement après le choix de l'assistant sur mobile.

Sources : `front_end/web/src/app/pages/aquariums/detail/aquarium-detail.component.html:412`, `:954` ; capture Cypress `solutions-mobile.png`.

### 8. Priorité moyenne — navigation et vocabulaire à rendre plus constants

**Constat :** accueil, mes aquariums, calendrier et paramètres ont des en-têtes différents. Le retour passe souvent par le logo ; les liens globaux du tableau de bord sont en partie au pied d'une page longue. La fiche a cinq onglets, dont « Protocoles » et « Dans mon Aquarium », moins immédiatement explicites que Mesures et Tâches.

**Modification recommandée :** réutiliser une navigation compacte et stable : Accueil, Aquariums, Entretien, Paramètres. Dans la fiche, envisager « Habitants » et « Routines guidées », ou une aide courte à ces termes. Ne pas regrouper les onglets sans tester la compréhension.

**Autres détails :** harmoniser tu/vous ; dans la tâche, choisir le type avant le titre qui en dépend ; proposer « Créer un aquarium » depuis l'état vide du formulaire de tâche.

**Validation attendue :** une personne retrouve son autre bac et son entretien sans utiliser le bouton Précédent du navigateur ni parcourir le pied de page.

## Ordre de travail recommandé

1. Mesures : fin de la reprise silencieuse, validation cohérente et messages d'erreur.
2. Bilan : état limité à ce qui est réellement évalué, données insuffisantes et ancienneté visibles.
3. Tableau de bord : tâches et bacs avant les récompenses.
4. Solutions : suppression des introductions répétées, synthèse et actions au premier plan.
5. Premier usage : demande d'avis après expérience réelle ; accès à l'aide plus facile à retrouver.
6. Harmonisation des libellés et de la navigation, après observation d'utilisateurs.

## Vérification auprès de cinq utilisateurs

Faire les essais sur téléphone sans expliquer où cliquer. Observer l'hésitation et la compréhension, pas seulement la réussite finale.

1. Créer un compte puis comprendre comment activer son email.
2. Créer un aquarium déjà en eau, sans se sentir obligé de lancer un cyclage.
3. Ajouter uniquement deux paramètres réellement mesurés et expliquer ce qui sera enregistré.
4. Prévoir un entretien puis le marquer comme réalisé.
5. Trouver les Solutions et expliquer ce que signifie le bilan, sa date et ses limites.
6. Revenir à un autre aquarium et retrouver les prochains entretiens.
7. Expliquer ce qui est inclus dans Classic et ce qu'apporte Premium, sans acheter.

Pour chaque tâche : réussite autonome ou aide nécessaire, endroits où l'utilisateur hésite, erreurs, compréhension du résultat. Le tableau de parcours administrateur mesure des actions ; il ne remplace pas l'observation de la compréhension.
