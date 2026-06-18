-- Migrare: adaugă rolurile noi de admin
-- Rulează în MySQL Workbench sau prin: mysql -u root -p licenta_booking < migratii/adauga_roluri_admin.sql

-- Pasul 1: extinde ENUM-ul cu noile roluri (păstrând temporar 'admin')
ALTER TABLE Utilizatori
  MODIFY COLUMN rol ENUM('super_admin','admin_hotel','admin_marketing','admin_booking','admin','client')
  NOT NULL DEFAULT 'client';

-- Pasul 2: promovează conturile existente de 'admin' la 'super_admin'
UPDATE Utilizatori SET rol = 'super_admin' WHERE rol = 'admin';

-- Pasul 3: scoate valoarea 'admin' din ENUM
ALTER TABLE Utilizatori
  MODIFY COLUMN rol ENUM('super_admin','admin_hotel','admin_marketing','admin_booking','client')
  NOT NULL DEFAULT 'client';
