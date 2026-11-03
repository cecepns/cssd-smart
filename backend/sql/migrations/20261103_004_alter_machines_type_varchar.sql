-- ============================================================
-- Migration: Ubah kolom type tabel machines menjadi VARCHAR(50)
-- Agar tipe mesin fleksibel dan dinamis (bebas diketik / ditambah tipe baru)
-- Tanggal: 2026-11-03
-- ============================================================

ALTER TABLE `machines` MODIFY COLUMN `type` VARCHAR(50) NOT NULL;

