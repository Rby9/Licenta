-- HoteluriRo: schemă pentru o bază NOUĂ și goală. Fără date personale.
-- Selectează baza țintă înainte de import. Nu rula peste baza existentă.

CREATE TABLE `Orase` (
  `id_oras` int NOT NULL AUTO_INCREMENT,
  `nume_oras` varchar(100) NOT NULL,
  `imagine_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_oras`),
  UNIQUE KEY `nume_oras` (`nume_oras`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Utilizatori` (
  `id_utilizator` int NOT NULL AUTO_INCREMENT,
  `nume_complet` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `parola` varchar(255) NOT NULL,
  `telefon` varchar(20) DEFAULT NULL,
  `rol` enum('super_admin','admin_hotel','admin_marketing','admin_booking','client') NOT NULL DEFAULT 'client',
  `email_marketing` tinyint(1) NOT NULL DEFAULT '0',
  `reset_token` varchar(64) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id_utilizator`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Hoteluri` (
  `id_hotel` int NOT NULL AUTO_INCREMENT,
  `id_oras` int DEFAULT NULL,
  `nume_hotel` varchar(150) NOT NULL,
  `adresa` varchar(255) DEFAULT NULL,
  `stele` int DEFAULT NULL,
  `descriere` text,
  `imagine_url` varchar(255) DEFAULT NULL,
  `imagine_2` varchar(255) DEFAULT NULL,
  `imagine_3` varchar(255) DEFAULT NULL,
  `latitudine` decimal(10,8) DEFAULT NULL,
  `longitudine` decimal(11,8) DEFAULT NULL,
  `oferta_activa` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_hotel`),
  KEY `id_oras` (`id_oras`),
  CONSTRAINT `hoteluri_ibfk_1` FOREIGN KEY (`id_oras`) REFERENCES `Orase` (`id_oras`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Categorii_Camere` (
  `id_categorie` int NOT NULL AUTO_INCREMENT,
  `id_hotel` int DEFAULT NULL,
  `denumire` varchar(100) NOT NULL,
  `capacitate` int NOT NULL,
  `pret_pe_noapte` decimal(10,2) NOT NULL,
  `descriere` text,
  PRIMARY KEY (`id_categorie`),
  KEY `id_hotel` (`id_hotel`),
  CONSTRAINT `categorii_camere_ibfk_1` FOREIGN KEY (`id_hotel`) REFERENCES `Hoteluri` (`id_hotel`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Camere` (
  `id_camera` int NOT NULL AUTO_INCREMENT,
  `numar_camera` varchar(20) NOT NULL,
  `id_categorie` int DEFAULT NULL,
  `status_camera` enum('activa','inactiva') DEFAULT 'activa',
  PRIMARY KEY (`id_camera`),
  KEY `id_categorie` (`id_categorie`),
  CONSTRAINT `camere_ibfk_1` FOREIGN KEY (`id_categorie`) REFERENCES `Categorii_Camere` (`id_categorie`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Rezervari` (
  `id_rezervare` int NOT NULL AUTO_INCREMENT,
  `id_utilizator` int DEFAULT NULL,
  `id_camera` int DEFAULT NULL,
  `data_checkin` date NOT NULL,
  `data_checkout` date NOT NULL,
  `pret_total` decimal(10,2) NOT NULL,
  `status_rezervare` enum('in_asteptare','confirmata','anulata') DEFAULT 'in_asteptare',
  `data_crearii` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `stripe_session_id` varchar(255) DEFAULT NULL,
  `comision_platforma` decimal(10,2) DEFAULT '0.00',
  `suma_hotel` decimal(10,2) DEFAULT '0.00',
  `status_plata` enum('in_asteptare','platita','rambursata') DEFAULT 'in_asteptare',
  `metoda_plata` enum('online_total','avans_online','cash_cazare') NOT NULL DEFAULT 'online_total',
  `suma_avans` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id_rezervare`),
  KEY `id_utilizator` (`id_utilizator`),
  KEY `id_camera` (`id_camera`),
  CONSTRAINT `rezervari_ibfk_1` FOREIGN KEY (`id_utilizator`) REFERENCES `Utilizatori` (`id_utilizator`) ON DELETE CASCADE,
  CONSTRAINT `rezervari_ibfk_2` FOREIGN KEY (`id_camera`) REFERENCES `Camere` (`id_camera`) ON DELETE CASCADE,
  UNIQUE KEY `uq_rezervari_stripe_session` (`stripe_session_id`),
  KEY `idx_rezervari_camera_interval` (`id_camera`,`data_checkin`,`data_checkout`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Facilitati` (
  `id_facilitate` int NOT NULL AUTO_INCREMENT,
  `nume` varchar(100) NOT NULL,
  `icon` varchar(10) NOT NULL,
  `categorie` enum('wellness','sport','servicii','transport','mancare') DEFAULT 'servicii',
  PRIMARY KEY (`id_facilitate`),
  UNIQUE KEY `nume` (`nume`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Hoteluri_Facilitati` (
  `id_hotel` int NOT NULL,
  `id_facilitate` int NOT NULL,
  PRIMARY KEY (`id_hotel`,`id_facilitate`),
  KEY `id_facilitate` (`id_facilitate`),
  CONSTRAINT `hoteluri_facilitati_ibfk_1` FOREIGN KEY (`id_hotel`) REFERENCES `Hoteluri` (`id_hotel`) ON DELETE CASCADE,
  CONSTRAINT `hoteluri_facilitati_ibfk_2` FOREIGN KEY (`id_facilitate`) REFERENCES `Facilitati` (`id_facilitate`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Hoteluri_Galerie` (
  `id_poza` int NOT NULL AUTO_INCREMENT,
  `id_hotel` int NOT NULL,
  `imagine_url` varchar(255) NOT NULL,
  `titlu` varchar(100) DEFAULT NULL,
  `ordine` int DEFAULT '0',
  PRIMARY KEY (`id_poza`),
  KEY `id_hotel` (`id_hotel`),
  CONSTRAINT `hoteluri_galerie_ibfk_1` FOREIGN KEY (`id_hotel`) REFERENCES `Hoteluri` (`id_hotel`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Recenzii` (
  `id_recenzie` int NOT NULL AUTO_INCREMENT,
  `id_hotel` int NOT NULL,
  `id_utilizator` int NOT NULL,
  `rating` tinyint NOT NULL,
  `comentariu` text,
  `data_recenziei` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_recenzie`),
  UNIQUE KEY `unic_recenzie` (`id_hotel`,`id_utilizator`),
  KEY `id_utilizator` (`id_utilizator`),
  CONSTRAINT `recenzii_ibfk_1` FOREIGN KEY (`id_hotel`) REFERENCES `Hoteluri` (`id_hotel`) ON DELETE CASCADE,
  CONSTRAINT `recenzii_ibfk_2` FOREIGN KEY (`id_utilizator`) REFERENCES `Utilizatori` (`id_utilizator`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Coduri_Reducere` (
  `id_cod` int NOT NULL AUTO_INCREMENT,
  `cod` varchar(30) NOT NULL,
  `procent_reducere` tinyint NOT NULL,
  `descriere` varchar(100) DEFAULT NULL,
  `data_start` date DEFAULT NULL,
  `data_expirare` date DEFAULT NULL,
  `utilizari_maxime` int DEFAULT NULL,
  `utilizari_curente` int NOT NULL DEFAULT '0',
  `activ` tinyint(1) NOT NULL DEFAULT '1',
  `data_creare` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cod`),
  UNIQUE KEY `cod` (`cod`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Oferte_Sezon` (
  `id_oferta` int NOT NULL AUTO_INCREMENT,
  `tip` varchar(50) NOT NULL,
  `titlu` varchar(200) NOT NULL,
  `descriere` text,
  `discount_procent` decimal(5,2) DEFAULT '0.00',
  `data_start` date DEFAULT NULL,
  `data_sfarsit` date DEFAULT NULL,
  `activa` tinyint(1) DEFAULT '1',
  `culoare` varchar(20) DEFAULT '#C4A050',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_oferta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Promotii` (
  `id_promotie` int NOT NULL AUTO_INCREMENT,
  `nume` varchar(100) DEFAULT NULL,
  `id_hotel` int DEFAULT NULL,
  `reducere_procent` int DEFAULT NULL,
  `data_start` date DEFAULT NULL,
  `data_end` date DEFAULT NULL,
  `tip` enum('craciun','revelion','paste','aniversare','sejur') DEFAULT NULL,
  PRIMARY KEY (`id_promotie`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
