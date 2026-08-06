-- Articles de démonstration pour prévisualiser la nouvelle mise en page publique.
-- Script idempotent : les slugs uniques empêchent la création de doublons.

SET NAMES utf8mb4;

INSERT IGNORE INTO themes (name, slug, createdAt, updatedAt) VALUES
  ('Bien démarrer', 'bien-demarrer', NOW(6), NOW(6)),
  ('Entretien', 'entretien', NOW(6), NOW(6)),
  ('Plantes & aquascaping', 'plantes-aquascaping', NOW(6), NOW(6));

SET @demo_author_id = (
  SELECT id FROM users
  ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'EDITOR' THEN 2 ELSE 3 END, id
  LIMIT 1
);

INSERT IGNORE INTO articles
  (title, slug, excerpt, content, coverImageUrl, status, viewsCount, publishedAt,
   authorId, reviewedById, reviewedAt, rejectReason, themeId, createdAt, updatedAt)
SELECT
  'Réussir le cyclage de son aquarium sans stress',
  'reussir-cyclage-aquarium-sans-stress',
  'Comprendre le cycle de l’azote, suivre les bons paramètres et savoir exactement quand introduire les premiers habitants.',
  'Un aquarium neuf paraît calme, mais une transformation essentielle est déjà en cours. Le cyclage installe les bactéries qui rendront l’eau sûre pour les poissons. Voici une méthode simple pour avancer sans précipitation.\n\n## Pourquoi faut-il attendre ?\n\nLes déchets organiques produisent de l’ammoniaque, puis des nitrites très toxiques. Des bactéries transforment ensuite ces nitrites en nitrates, beaucoup mieux tolérés. Cette colonie bactérienne a besoin de temps pour s’installer dans le filtre et le sol.\n\n> Un aquarium cyclé n’est pas un aquarium qui a simplement tourné trois semaines : c’est un bac dont les nitrites sont revenus durablement à zéro.\n\n## Les 4 étapes du démarrage\n\n1. Installez le sol, le décor, les plantes et remplissez le bac.\n2. Démarrez le filtre et le chauffage sans jamais les interrompre.\n3. Testez les nitrites deux à trois fois par semaine.\n4. Attendez le pic puis confirmez une valeur à zéro pendant plusieurs jours.\n\n[!ASTUCE] Ajoutez une petite pincée de nourriture au démarrage. Sa décomposition nourrit doucement les premières bactéries.\n\n## Les erreurs qui rallongent le cyclage\n\n- Nettoyer les masses filtrantes sous l’eau du robinet\n- Changer toutes les masses du filtre en même temps\n- Introduire des poissons pour « lancer » le cycle\n- Ajouter de nombreux produits sans mesurer leur effet\n\n[!ATTENTION] Une eau limpide ne garantit jamais l’absence de nitrites. Seul un test adapté permet de décider si le bac est prêt.\n\n## Le jour de l’introduction\n\nCommencez par un petit groupe compatible avec le volume. Acclimatez-le lentement, nourrissez peu durant les premiers jours et continuez de surveiller les nitrites. La population peut ensuite être complétée progressivement.\n\n[!À RETENIR] La patience des premières semaines évite la majorité des problèmes des premiers mois.',
  NULL, 'PUBLISHED', 0, NOW(6), @demo_author_id, NULL, NULL, NULL,
  (SELECT id FROM themes WHERE slug = 'bien-demarrer' LIMIT 1), NOW(6), NOW(6)
WHERE @demo_author_id IS NOT NULL;

INSERT IGNORE INTO articles
  (title, slug, excerpt, content, coverImageUrl, status, viewsCount, publishedAt,
   authorId, reviewedById, reviewedAt, rejectReason, themeId, createdAt, updatedAt)
SELECT
  'La routine de 20 minutes pour un aquarium toujours propre',
  'routine-20-minutes-aquarium-propre',
  'Une routine hebdomadaire réaliste pour garder une eau claire, des poissons sereins et du temps pour profiter de son aquarium.',
  'Un entretien efficace ne consiste pas à tout nettoyer. Le bon rythme préserve l’équilibre biologique tout en retirant ce qui s’accumule réellement. Cette routine courte suffit pour la plupart des aquariums équilibrés.\n\n## Avant de commencer\n\nPréparez un seau réservé à l’aquarium, un tuyau, une raclette et une serviette. Coupez le chauffage s’il risque de rester hors de l’eau, mais gardez les masses filtrantes humides.\n\n## Minute 0 à 5 : observer avant d’agir\n\n- Vérifiez le comportement et l’appétit des poissons\n- Repérez les feuilles abîmées et les zones de déchets\n- Contrôlez la température\n- Notez tout changement inhabituel dans AquaManager\n\n> L’observation est la partie la plus importante de l’entretien : elle permet d’agir tôt et avec mesure.\n\n## Minute 5 à 15 : changer l’eau intelligemment\n\nSiphonnez environ 15 à 25 % du volume en insistant sur les zones accessibles. Il n’est pas nécessaire de retourner tout le sol. Profitez de la baisse du niveau pour nettoyer la vitre avant.\n\n[!ASTUCE] Gardez volontairement une vitre latérale légèrement patinée : les escargots et certains poissons y trouvent une source de nourriture naturelle.\n\n## Minute 15 à 20 : finaliser\n\n1. Retirez les feuilles très abîmées.\n2. Remettez une eau à température proche de celle du bac.\n3. Redémarrez le matériel et vérifiez le débit.\n4. Essuyez les vitres extérieures.\n\n## Et le filtre ?\n\nNettoyez-le seulement quand son débit diminue. Rincez une partie des mousses dans l’eau retirée de l’aquarium et ne remplacez jamais toutes les masses biologiques à la fois.\n\n[!ATTENTION] Un aquarium trop nettoyé peut devenir moins stable. Le but est de retirer l’excès, pas de rendre le décor stérile.\n\n[!À RETENIR] Une petite routine régulière est plus sûre et beaucoup plus facile qu’un grand nettoyage occasionnel.',
  NULL, 'PUBLISHED', 0, DATE_SUB(NOW(6), INTERVAL 1 DAY), @demo_author_id, NULL, NULL, NULL,
  (SELECT id FROM themes WHERE slug = 'entretien' LIMIT 1), NOW(6), NOW(6)
WHERE @demo_author_id IS NOT NULL;

INSERT IGNORE INTO articles
  (title, slug, excerpt, content, coverImageUrl, status, viewsCount, publishedAt,
   authorId, reviewedById, reviewedAt, rejectReason, themeId, createdAt, updatedAt)
SELECT
  '7 plantes faciles qui transforment un premier aquarium',
  '7-plantes-faciles-premier-aquarium',
  'Des plantes robustes et décoratives pour composer un aquarium vivant, même sans injection de CO₂ ni éclairage très puissant.',
  'Les plantes ne sont pas qu’un décor. Elles consomment des nutriments, offrent des refuges et rendent l’aquarium plus naturel. Pour débuter, mieux vaut choisir quelques espèces robustes et les laisser s’installer.\n\n## 1. Anubias : la valeur sûre\n\nFixez son rhizome sur une pierre ou une racine sans l’enterrer. Sa croissance lente et ses feuilles épaisses conviennent parfaitement aux zones ombragées.\n\n## 2. Microsorum : un beau volume sans sol riche\n\nLa fougère de Java se fixe elle aussi sur le décor. Elle forme progressivement un bouquet graphique au milieu ou à l’arrière-plan.\n\n## 3. Cryptocoryne : idéale au premier plan\n\nElle apprécie un sol nutritif mais reste peu exigeante. Une fonte des anciennes feuilles après plantation est fréquente : de nouvelles feuilles adaptées au bac apparaissent ensuite.\n\n[!ASTUCE] Plantez par groupes impairs et laissez un peu d’espace entre les pieds. Le résultat paraît immédiatement plus naturel.\n\n## 4. Vallisneria : un rideau végétal\n\nSes longues feuilles habillent rapidement le fond du bac. Elle se multiplie par stolons et peut facilement être contenue en retirant les jeunes pousses superflues.\n\n## 5. Hygrophila : la pousse rapide\n\nSa croissance aide à concurrencer les algues au démarrage. Taillez les tiges au-dessus d’un nœud et replantez les sommets pour densifier le massif.\n\n## 6. Mousse de Java : le refuge des petits habitants\n\nAttachée à une branche, elle forme une zone très appréciée des crevettes et des alevins. Une taille légère évite qu’elle ne retienne trop de déchets.\n\n## 7. Limnophila sessiliflora : légère et lumineuse\n\nSes tiges fines donnent du mouvement au décor. Sa croissance rapide en fait aussi un bon indicateur : des pousses pâles signalent souvent un manque de nutriments.\n\n## Composer un décor équilibré\n\n- Une espèce basse au premier plan\n- Un groupe principal au milieu\n- Deux espèces rapides à l’arrière-plan\n- Une plante fixée sur la racine ou la pierre centrale\n\n[!ATTENTION] Retirez toujours la laine de roche autour des racines et rincez soigneusement les plantes avant leur installation.\n\n[!À RETENIR] Commencez avec peu d’espèces mais plusieurs pieds de chacune : la lecture du décor sera plus forte et l’entretien plus simple.',
  NULL, 'PUBLISHED', 0, DATE_SUB(NOW(6), INTERVAL 2 DAY), @demo_author_id, NULL, NULL, NULL,
  (SELECT id FROM themes WHERE slug = 'plantes-aquascaping' LIMIT 1), NOW(6), NOW(6)
WHERE @demo_author_id IS NOT NULL;
