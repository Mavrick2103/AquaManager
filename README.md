# AquaManager

Application de suivi d'aquariums : paramètres d'eau, poissons et plantes,
calendrier d'entretien, recommandations et rappels. Elle comprend des catalogues
publics, des articles, des abonnements, un espace d'administration et des fonctions IA.

## Organisation

- front_end/web : Angular 20, Material, Chart.js et rendu serveur des pages publiques.
- back_end : API NestJS 11, TypeORM et MySQL 8.
- back_end/test : tests unitaires et tests HTTP de sécurité.
- back_end/migrations : ancien historique SQL manuel et nouvelles migrations suivies dans managed.
- docker-compose.yml : MySQL, API, frontend Nginx, SSR et Certbot.
- .github/workflows : tests, builds et déploiement manuel.

## Développement

Prérequis : Node.js compatible avec les packages du projet (la CI utilise Node 20),
npm et MySQL 8. Installer les dépendances séparément :

```sh
npm ci --prefix back_end
npm ci --prefix front_end/web
```

Créer back_end/.env.development en utilisant .env.example comme référence.
Renseigner au minimum DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME et JWT_SECRET
(secret aléatoire privé d'au moins 16 caractères). Configurer APP_URL et SMTP pour
l'inscription et les confirmations d'e-mail. Les identifiants Stripe, PayPal,
OpenAI et Instagram sont nécessaires uniquement pour leurs fonctionnalités.
Ne jamais commiter les fichiers d'environnement privés.

Pour une base locale neuve et jetable, NODE_ENV=development et TYPEORM_SYNC=true
permettent à TypeORM de créer les tables. Désactiver la synchronisation sur une
base contenant des données à préserver. Voir back_end/DEPLOYMENT.md pour les
migrations d'une base existante et les limites d'installation en production.

Lancer dans deux terminaux :

```sh
npm run start:dev --prefix back_end
npm start --prefix front_end/web
```

Le frontend de développement est sur http://localhost:4200 et l'API sous
http://localhost:3000/api. Docker/Nginx utilise les domaines et certificats de
production ; sa configuration n'est pas un démarrage local autonome sans préparation.

## Vérifications

```sh
npm test --prefix back_end -- --silent
npm run build --prefix back_end
npm run test:ci --prefix front_end/web
npm run build --prefix front_end/web
```

Les tests frontend nécessitent Chrome/Chromium. Cypress dispose d'un script
cypress:run et d'un workflow dédié. Les tests HTTP de sécurité couvrent les guards,
les sessions et les DTO avec un stockage SQLite en mémoire.

## Déploiement

Consulter [la procédure de déploiement et de migration](back_end/DEPLOYMENT.md).
Le workflow CD reste manuel : tests, build, sauvegarde, migrations, redémarrage
et contrôle HTTP. La mise à jour des sessions nécessite une reconnexion générale.
Le contrôle de production doit inclure une recette MySQL/SMTP et une restauration
de sauvegarde ; les tests locaux seuls ne valident pas ces services externes.
