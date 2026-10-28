# Progression AquaManager

Le catalogue et les seuils se trouvent dans `progression-policy.ts`. Le parcours est identique pour Classic et Premium. Il ne récompense ni achats, ni ajout d’animaux, ni consommation d’IA, ni score biologique.

- Catalogue de 18 missions dans six catégories : visites, mesures, observations dans les commentaires des mesures, planification, soins terminés, consultation des solutions Classic.
- Chaque nouveau mois propose quatre missions, une par catégorie sélectionnée. Deux catégories changent chaque mois et les variantes des catégories conservées changent aussi. La sélection dépend du mois et de l’utilisateur, sans tirage à chaque ouverture. Elle est enregistrée en base pour rester stable tout le mois. Les six missions déjà attribuées avant cette rotation restent en place jusqu’à la fin de leur mois.
- Les jours sont calculés en Europe/Paris. Une seule attribution quotidienne d’XP par catégorie (les visites seules ne donnent pas d’XP).
- Les missions donnent un bonus une seule fois. Elles se renouvellent le premier du mois ; aucune pénalité pour les objectifs non terminés.
- Une tâche terminée n’est comptée qu’une fois, même après réouverture. Chaque occurrence récurrente a sa propre référence. Les tâches futures ou le modèle complet d’une série ne rapportent pas de récompense de soin.
- Les titres sont automatiquement débloqués selon l’XP et le meilleur apparaît sur le tableau de bord. Ce sont des récompenses visuelles, sans effet sur la facturation ni les quotas.

## Transition depuis l’ancien catalogue

Les XP et badges déjà acquis sont conservés. Les anciennes missions en cours sont archivées sans effacer leur progression stockée. Une ancienne mission terminée ce mois-ci occupe sa catégorie : elle n’est pas doublée par une mission V2 équivalente. Plusieurs anciennes missions terminées d’une même catégorie ne produisent qu’une carte dans le parcours courant. Les historiques restent en base.

Le nouveau décompte des jours commence au déploiement. Aucun historique ancien n’est transformé en jours de suivi fictifs. Les identifiants `FIRST_MEASUREMENT`, `XP_1000` et `SEVEN_DAY_STREAK` sont réutilisés.

## Persistance et vérifications

Migration requise : `202610020002-gamification-activities.cjs`, exécutée par le mécanisme habituel de migrations. Les activités ont une clé unique par utilisateur et événement, et sont supprimées avec le compte. Les reçus, les bonus, les badges et l’XP sont enregistrés ensemble sous verrou de compte, sans appel externe dans la transaction.

Après compilation du serveur, `node scripts/verify-gamification.cjs` vérifie la migration et les attributions concurrentes dans une base temporaire du conteneur MySQL local. La base applicative n’est pas utilisée. Les tests `progression-policy.unit.spec.ts`, `task.service.unit.spec.ts` et `gamification.cy.ts` couvrent les règles, les occurrences et l’affichage.
