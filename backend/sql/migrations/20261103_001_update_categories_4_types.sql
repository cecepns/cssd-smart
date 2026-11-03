-- ============================================================
-- Migration: 20261103_001_update_categories_4_types.sql
-- Description: Memperbarui kategori jenis alat CSSD menjadi 4 kategori:
--              1. Alat Satuan
--              2. Set Instrumen
--              3. Duk & Jas Operasi
--              4. Kasa Steril
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Buka ENUM untuk menampung nilai lama dan baru
ALTER TABLE `items` MODIFY COLUMN `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL;
ALTER TABLE `packagings` MODIFY COLUMN `package_type` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL;
ALTER TABLE `sterile_stock` MODIFY COLUMN `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL;

-- 2. Migrasi data lama 'Instrumen / Set Alat'
UPDATE `items` SET `category` = CASE 
  WHEN `name` LIKE '%Set%' OR `name` LIKE '%SET%' OR `code` LIKE 'SET%' OR `code` LIKE 'INS%' THEN 'Set Instrumen'
  ELSE 'Alat Satuan'
END WHERE `category` = 'Instrumen / Set Alat';

UPDATE `packagings` SET `package_type` = CASE
  WHEN `material` = 'Container' OR `unit_label` = 'set' THEN 'Set Instrumen'
  ELSE 'Alat Satuan'
END WHERE `package_type` = 'Instrumen / Set Alat';

UPDATE `sterile_stock` SET `category` = CASE
  WHEN `item_name` LIKE '%Set%' OR `item_name` LIKE '%SET%' OR `unit_label` = 'set' THEN 'Set Instrumen'
  ELSE 'Alat Satuan'
END WHERE `category` = 'Instrumen / Set Alat';

-- 3. Kunci ENUM hanya pada 4 kategori standar
ALTER TABLE `items` MODIFY COLUMN `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL;
ALTER TABLE `packagings` MODIFY COLUMN `package_type` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL;
ALTER TABLE `sterile_stock` MODIFY COLUMN `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL;

-- 4. Tambah contoh Alat Satuan jika belum ada
INSERT INTO `items` (`code`, `name`, `category`, `shelf_life_months`, `description`)
SELECT 'ALT-GNT', 'Gunting Hecting Satuan', 'Alat Satuan', 6, 'Gunting angkat jahitan / hecting lepasan'
WHERE NOT EXISTS (SELECT 1 FROM `items` WHERE `code` = 'ALT-GNT');

INSERT INTO `items` (`code`, `name`, `category`, `shelf_life_months`, `description`)
SELECT 'ALT-PNS', 'Pinset Sirurgis Satuan', 'Alat Satuan', 6, 'Pinset sirurgis lepasan IGD/Poli'
WHERE NOT EXISTS (SELECT 1 FROM `items` WHERE `code` = 'ALT-PNS');

SET FOREIGN_KEY_CHECKS = 1;

