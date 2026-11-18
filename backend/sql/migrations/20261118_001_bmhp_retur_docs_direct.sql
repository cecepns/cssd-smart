-- =============================================================================
-- CSSD SMART - MIGRATION DIRECT SQL (COPY-PASTE KE TAB SQL PHPMYADMIN CPANEL)
-- File    : 20261118_001_bmhp_retur_docs_direct.sql
-- Tujuan  : Mendukung Retur/Koreksi BMHP & Riwayat Dokumen Barang Keluar
--           (NPB, SPB, SPPB, BAST) terintegrasi penuh dalam 1 database.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ubah tipe transaksi BMHP menjadi VARCHAR agar mendukung MASUK, KELUAR,
--    RETUR_MASUK, RETUR_KELUAR, KOREKSI_TAMBAH, KOREKSI_KURANG
ALTER TABLE `bmhp_transactions`
  MODIFY COLUMN `type` VARCHAR(30) NOT NULL DEFAULT 'MASUK';

-- 2. Tambah kolom nomor dokumen, jenis dokumen, referensi transaksi, alasan koreksi, & penerima
ALTER TABLE `bmhp_transactions`
  ADD COLUMN `doc_number` VARCHAR(60) DEFAULT NULL AFTER `type`,
  ADD COLUMN `doc_type` VARCHAR(30) DEFAULT NULL AFTER `doc_number`,
  ADD COLUMN `ref_transaction_id` INT UNSIGNED DEFAULT NULL AFTER `doc_type`,
  ADD COLUMN `correction_reason` VARCHAR(255) DEFAULT NULL AFTER `notes`,
  ADD COLUMN `receiver_name` VARCHAR(100) DEFAULT NULL AFTER `officer`;

-- 3. Default batas maksimum reuse DTT menjadi 4 (bisa diubah per alat 3x atau 4x)
ALTER TABLE `dtt_receipts`
  MODIFY COLUMN `max_reuse_limit` INT UNSIGNED NOT NULL DEFAULT 4;

SET FOREIGN_KEY_CHECKS = 1;
