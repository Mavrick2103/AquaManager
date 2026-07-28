-- Migration production du module Marketing IA.
-- Compatible MySQL 8, idempotente, sans synchronize TypeORM.

CREATE TABLE IF NOT EXISTS `marketing_post` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(160) NOT NULL,
  `caption` text NOT NULL,
  `mediaUrl` varchar(500) DEFAULT NULL,
  `sourceUrl` varchar(500) DEFAULT NULL,
  `format` enum('POST','CAROUSEL','REEL','STORY') NOT NULL DEFAULT 'POST',
  `status` enum('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
  `scheduledAt` datetime(6) DEFAULT NULL,
  `rejectionReason` varchar(500) DEFAULT NULL,
  `generatedByAi` tinyint NOT NULL DEFAULT 0,
  `aiRationale` varchar(700) DEFAULT NULL,
  `createdById` int NOT NULL,
  `reviewedById` int DEFAULT NULL,
  `reviewedAt` datetime(6) DEFAULT NULL,
  `instagramMediaId` varchar(120) DEFAULT NULL,
  `publishedAt` datetime(6) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_marketing_post_status` (`status`),
  KEY `IDX_marketing_post_scheduled_at` (`scheduledAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `marketing_agent_settings` (
  `id` int NOT NULL DEFAULT 1,
  `enabled` tinyint NOT NULL DEFAULT 1,
  `cadence` enum('WEEKLY','BIWEEKLY','MONTHLY') NOT NULL DEFAULT 'WEEKLY',
  `dayOfWeek` tinyint NOT NULL DEFAULT 1,
  `hour` tinyint NOT NULL DEFAULT 9,
  `minute` tinyint NOT NULL DEFAULT 0,
  `timezone` varchar(60) NOT NULL DEFAULT 'Europe/Paris',
  `lastGeneratedAt` datetime(6) DEFAULT NULL,
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `marketing_agent_settings`
  (`id`, `enabled`, `cadence`, `dayOfWeek`, `hour`, `minute`, `timezone`, `lastGeneratedAt`)
VALUES
  (1, 1, 'WEEKLY', 1, 9, 0, 'Europe/Paris', NULL)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);
