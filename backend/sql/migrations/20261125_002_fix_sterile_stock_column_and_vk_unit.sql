-- =============================================================================
-- MIGRATION: 20261125_002_fix_sterile_stock_column_and_vk_unit.sql
-- 1. Tambah kolom sterilized_date di sterile_stock agar kompatibel penuh
-- 2. Link akun unit (VK_BERSALIN, NICU, THT) ke unit_id masing-masing di tabel users
-- Jalankan di phpMyAdmin cPanel database kinq6231_cssd-smart
-- =============================================================================

-- 1. Tambah kolom sterilized_date di tabel sterile_stock (jika belum ada)
ALTER TABLE `sterile_stock` ADD COLUMN IF NOT EXISTS `sterilized_date` DATE DEFAULT NULL AFTER `sterile_date`;

-- 2. Samakan sterilized_date dengan sterile_date
UPDATE `sterile_stock`
SET `sterilized_date` = `sterile_date`
WHERE `sterilized_date` IS NULL AND `sterile_date` IS NOT NULL;

-- 3. Hubungkan akun VK_BERSALIN ke Unit Ruang Bersalin (id = 4)
UPDATE `users` u
JOIN `units` un ON (un.code = 'VK' OR un.name LIKE '%Bersalin%')
SET u.unit_id = un.id, u.is_active = 1
WHERE (LOWER(u.username) LIKE '%vk%' OR LOWER(u.username) LIKE '%bersalin%');

-- Fallback jika join tidak menemukan baris
UPDATE `users`
SET `unit_id` = 4, `is_active` = 1
WHERE (LOWER(`username`) LIKE '%vk%' OR LOWER(`username`) LIKE '%bersalin%')
  AND (`unit_id` IS NULL OR `unit_id` = 0);

-- 4. Hubungkan akun NICU ke Unit NICU
UPDATE `users` u
JOIN `units` un ON (un.code = 'NICU' OR un.name LIKE '%NICU%')
SET u.unit_id = un.id, u.is_active = 1
WHERE (LOWER(u.username) LIKE '%nicu%');

-- 5. Hubungkan akun THT ke Unit THT
UPDATE `users` u
JOIN `units` un ON (un.code = 'THT' OR un.name LIKE '%THT%')
SET u.unit_id = un.id, u.is_active = 1
WHERE (LOWER(u.username) LIKE '%tht%');
