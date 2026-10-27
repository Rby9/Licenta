-- Checkout comun pentru un grup de adulți, creat după aprobarea ofertei.
-- Nu este executat automat de aplicație sau de database/init.js.
-- Necesită revizuire, backup separat și aprobare explicită înainte de aplicare.
-- MySQL 8.0.16+; InnoDB. DDL produce commit implicit: nu este o migrare atomică.
-- La o aplicare întreruptă se inspectează schema; nu se reexecută orbește.
-- Nu modifică înregistrările existente. Rezervările individuale păstrează fluxul actual.

CREATE TABLE `Rezervari_Grup` (
    `id_grup` bigint unsigned NOT NULL AUTO_INCREMENT,
    `id_utilizator` int NOT NULL,
    `id_hotel` int NOT NULL,
    `data_checkin` date NOT NULL,
    `data_checkout` date NOT NULL,
    `nr_adulti` smallint unsigned NOT NULL,
    `pret_total` decimal(10,2) NOT NULL,
    `metoda_plata` enum('online_total','avans_online','cash_cazare') NOT NULL,
    `suma_avans` decimal(10,2) DEFAULT NULL,
    `status_rezervare` enum('in_asteptare','confirmata','anulata','expirata') NOT NULL DEFAULT 'in_asteptare',
    `status_plata` enum('in_asteptare','avans_platit','platita','rambursare_in_curs','rambursata') NOT NULL DEFAULT 'in_asteptare',
    `stripe_session_id` varchar(255) DEFAULT NULL,
    `stripe_payment_intent_id` varchar(255) DEFAULT NULL,
    -- UUID reutilizat la retry/dublu click: aceeași aprobare nu creează două comenzi.
    `cerere_aprobare_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- SHA-256 al ofertei canonice: camere, ocupare, perioadă, prețuri și metoda plății.
    `oferta_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `aprobat_la` datetime(6) NOT NULL,
    `expira_la` datetime(6) NOT NULL,
    `data_crearii` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_grup`),
    UNIQUE KEY `uq_grup_cerere_aprobare` (`cerere_aprobare_id`),
    UNIQUE KEY `uq_grup_stripe_session` (`stripe_session_id`),
    UNIQUE KEY `uq_grup_stripe_intent` (`stripe_payment_intent_id`),
    KEY `idx_grup_utilizator` (`id_utilizator`,`data_crearii`),
    CONSTRAINT `fk_grup_utilizator` FOREIGN KEY (`id_utilizator`) REFERENCES `Utilizatori` (`id_utilizator`) ON DELETE RESTRICT,
    CONSTRAINT `fk_grup_hotel` FOREIGN KEY (`id_hotel`) REFERENCES `Hoteluri` (`id_hotel`) ON DELETE RESTRICT,
    CONSTRAINT `chk_grup_interval` CHECK (`data_checkout` > `data_checkin`),
    CONSTRAINT `chk_grup_adulti` CHECK (`nr_adulti` BETWEEN 1 AND 100),
    CONSTRAINT `chk_grup_total` CHECK (`pret_total` > 0),
    CONSTRAINT `chk_grup_avans` CHECK (
        (`metoda_plata`='avans_online' AND `suma_avans` IS NOT NULL AND `suma_avans` > 0 AND `suma_avans` <= `pret_total`)
        OR (`metoda_plata`<>'avans_online' AND `suma_avans` IS NULL)
    ),
    CONSTRAINT `chk_grup_aprobare_expirare` CHECK (`expira_la` > `aprobat_la`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Câte o linie pentru fiecare cameră, inclusiv când mai multe au aceeași categorie.
-- Reține oferta aprobată; nu reprezintă blocarea unei camere fizice.
CREATE TABLE `Rezervari_Grup_Camere` (
    `id_linie_grup` bigint unsigned NOT NULL AUTO_INCREMENT,
    `id_grup` bigint unsigned NOT NULL,
    `id_categorie` int NOT NULL,
    `nr_adulti` smallint unsigned NOT NULL,
    `pret_pe_noapte` decimal(10,2) NOT NULL,
    `pret_total` decimal(10,2) NOT NULL,
    PRIMARY KEY (`id_linie_grup`),
    KEY `idx_grup_camere` (`id_grup`),
    CONSTRAINT `fk_grup_camera_grup` FOREIGN KEY (`id_grup`) REFERENCES `Rezervari_Grup` (`id_grup`) ON DELETE RESTRICT,
    CONSTRAINT `fk_grup_camera_categorie` FOREIGN KEY (`id_categorie`) REFERENCES `Categorii_Camere` (`id_categorie`) ON DELETE RESTRICT,
    CONSTRAINT `chk_grup_camera_adulti` CHECK (`nr_adulti` BETWEEN 1 AND 100),
    CONSTRAINT `chk_grup_camera_pret` CHECK (`pret_pe_noapte` > 0 AND `pret_total` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- NULL pentru rezervările individuale deja existente; fără UPDATE de date istorice.
-- Sesiunea Stripe comună este pe Rezervari_Grup. Rezervari.stripe_session_id
-- rămâne NULL pentru camerele unui grup; unicitatea existentă nu este eliminată.
ALTER TABLE `Rezervari`
    ADD COLUMN `id_linie_grup` bigint unsigned DEFAULT NULL,
    ADD UNIQUE KEY `uq_rezervare_linie_grup` (`id_linie_grup`),
    ADD CONSTRAINT `fk_rezervare_linie_grup` FOREIGN KEY (`id_linie_grup`)
        REFERENCES `Rezervari_Grup_Camere` (`id_linie_grup`) ON DELETE RESTRICT;
