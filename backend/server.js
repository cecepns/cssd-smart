'use strict';

/**
 * CSSD SMART - Sterile Management System (RSU Serpong Utara)
 * Single-file Express + MySQL REST API.
 *
 * Alur proses (otomatis terhubung):
 *  1 Alat Kotor Masuk (barcode) -> 2 Pencucian -> 3 Pengeringan & Pemeriksaan -> 4 Pengemasan
 *  -> 5 Sterilisasi -> 6 Verifikasi (LULUS -> 7 Stok Steril | GAGAL -> Karantina)
 *  -> 8 Distribusi Alat Steril (barcode) / 9 Distribusi Kasa Steril (barcode)
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/* ============================================================
 * CONFIG
 * ============================================================ */
const env = process.env;
const IS_PROD = env.NODE_ENV === 'production';
const PORT = Number(env.PORT) || 5000;
const TZ = env.APP_TIMEZONE || 'Asia/Jakarta';
const JWT_SECRET = env.JWT_SECRET || (IS_PROD ? null : 'dev-only-secret-change-me');
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || '12h';
const UPLOAD_FOLDER = env.UPLOAD_DIR || 'uploads-cssd-smart';
const UPLOAD_DIR = path.join(__dirname, UPLOAD_FOLDER);
const DEFAULT_SHELF_LIFE_MONTHS = Number(env.DEFAULT_SHELF_LIFE_MONTHS) || 6;
const ALLOWED_LIMITS = [10, 25, 50, 100];
const EXPORT_MAX_ROWS = 10000;

if (!JWT_SECRET) {
  console.error('JWT_SECRET wajib diisi pada file .env untuk mode production.');
  process.exit(1);
}

['images', 'signatures'].forEach((dir) => fs.mkdirSync(path.join(UPLOAD_DIR, dir), { recursive: true }));

const PACKAGE_TYPES = ['Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril'];
const PREFIX_BY_TYPE = {
  'Alat Satuan': 'AS',
  'Set Instrumen': 'ST',
  'Duk & Jas Operasi': 'PG',
  'Kasa Steril': 'KS',
  'Instrumen / Set Alat': 'SM',
};
const ROLES = ['admin', 'petugas', 'unit'];
const INDICATOR = ['Sesuai', 'Tidak Sesuai'];

const pool = mysql.createPool({
  host: env.DB_HOST || 'localhost',
  port: Number(env.DB_PORT) || 3306,
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'cssd_smart',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true,
  charset: 'utf8mb4',
});

/* ============================================================
 * HELPERS
 * ============================================================ */
class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const todayStr = () => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date());
const pad = (n, size = 3) => String(n).padStart(size, '0');
const ddmmyy = (d) => `${d.slice(8, 10)}${d.slice(5, 7)}${d.slice(2, 4)}`;

function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

const sanitizeText = (v) =>
  String(v)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim();

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'ID tidak valid');
  return id;
};

async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Counter atomik: harian (per tanggal) atau kumulatif (tanggal 1970-01-01). */
async function nextCounter(conn, name, scopeDate = '1970-01-01') {
  await conn.query(
    'INSERT INTO counters (name, counter_date, value) VALUES (?, ?, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE value = LAST_INSERT_ID(value + 1)',
    [name, scopeDate]
  );
  const [[row]] = await conn.query('SELECT LAST_INSERT_ID() AS id');
  return Number(row.id);
}

async function makeCode(conn, prefix, dateStr) {
  const date = dateStr || todayStr();
  const n = await nextCounter(conn, prefix, date);
  return `${prefix}-${ddmmyy(date)}-${pad(n)}`;
}

/* ============================================================
 * VALIDATION
 * ============================================================ */
const field = (name, type, opts = {}) => ({ name, type, ...opts });
const PATH_REGEX = /^(images|signatures)\/[a-f0-9]{32}\.(png|jpg|webp)$/;

function validate(fields, body, { partial = false } = {}) {
  const out = {};
  const errors = {};
  const source = body && typeof body === 'object' ? body : {};

  for (const f of fields) {
    const label = f.label || f.name;
    const raw = source[f.name];
    const empty = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');

    if (empty) {
      if (partial && raw === undefined) continue;
      if (!partial && f.default !== undefined) {
        out[f.name] = typeof f.default === 'function' ? f.default() : f.default;
        continue;
      }
      if (f.required && !(partial && raw === undefined)) {
        errors[f.name] = `${label} wajib diisi`;
        continue;
      }
      out[f.name] = null;
      continue;
    }

    switch (f.type) {
      case 'string': {
        const v = sanitizeText(raw);
        if (f.min && v.length < f.min) errors[f.name] = `${label} minimal ${f.min} karakter`;
        else if (v.length > (f.max || 255)) errors[f.name] = `${label} maksimal ${f.max || 255} karakter`;
        else out[f.name] = v;
        break;
      }
      case 'int':
      case 'number': {
        const n = Number(raw);
        if (!Number.isFinite(n) || (f.type === 'int' && !Number.isInteger(n))) errors[f.name] = `${label} harus berupa angka${f.type === 'int' ? ' bulat' : ''}`;
        else if (f.min !== undefined && n < f.min) errors[f.name] = `${label} minimal ${f.min}`;
        else if (f.max !== undefined && n > f.max) errors[f.name] = `${label} maksimal ${f.max}`;
        else out[f.name] = n;
        break;
      }
      case 'bool':
        out[f.name] = raw === true || raw === 1 || raw === '1' || raw === 'true' ? 1 : 0;
        break;
      case 'date': {
        const v = String(raw);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) errors[f.name] = `${label} tidak valid (YYYY-MM-DD)`;
        else out[f.name] = v;
        break;
      }
      case 'enum':
        if (!f.values.includes(raw)) errors[f.name] = `${label} harus salah satu dari: ${f.values.join(', ')}`;
        else out[f.name] = raw;
        break;
      case 'path':
        if (!PATH_REGEX.test(String(raw))) errors[f.name] = `${label} tidak valid`;
        else out[f.name] = String(raw);
        break;
      default:
        out[f.name] = sanitizeText(raw);
    }
  }

  if (Object.keys(errors).length) throw new HttpError(422, 'Validasi gagal, periksa kembali isian Anda', errors);
  return out;
}

/* ============================================================
 * LIST / CSV
 * ============================================================ */
async function runList(cfg, query, { all = false, user = null } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const requested = parseInt(query.limit, 10);
  const limit = all ? EXPORT_MAX_ROWS : ALLOWED_LIMITS.includes(requested) ? requested : 10;

  const where = [];
  const params = [];

  // Filter unit luar: hanya bisa melihat transaksi dari unitnya masing-masing
  if (user?.role === 'unit' && user.unit_id && cfg.unitColumn) {
    where.push(`${cfg.unitColumn} = ?`);
    params.push(user.unit_id);
  }

  const search = typeof query.search === 'string' ? sanitizeText(query.search).slice(0, 100) : '';
  if (search && cfg.search && cfg.search.length) {
    const like = `%${escapeLike(search)}%`;
    where.push(`(${cfg.search.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    cfg.search.forEach(() => params.push(like));
  }

  for (const [key, column] of Object.entries(cfg.filters || {})) {
    const value = query[key];
    if (value === undefined || value === '' || typeof value !== 'string') continue;
    if (typeof column === 'function') {
      const customCond = column(value);
      if (customCond) where.push(customCond);
      continue;
    }
    const values = value.split(',').map((v) => v.trim()).filter(Boolean);
    if (values.length > 1) {
      where.push(`${column} IN (?)`);
      params.push(values);
    } else if (values.length === 1) {
      where.push(`${column} = ?`);
      params.push(values[0]);
    }
  }

  if (cfg.dateColumn) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(query.date_from || '')) {
      where.push(`${cfg.dateColumn} >= ?`);
      params.push(query.date_from);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(query.date_to || '')) {
      where.push(`${cfg.dateColumn} <= ?`);
      params.push(query.date_to);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortColumn = cfg.sort[query.sort_by] || cfg.sort[cfg.defaultSort];
  const order = String(query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${cfg.from} ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT ${cfg.select} FROM ${cfg.from} ${whereSql} ORDER BY ${sortColumn} ${order}, ${cfg.pk} DESC LIMIT ? OFFSET ?`,
    [...params, limit, all ? 0 : (page - 1) * limit]
  );
  return { rows, total, page, limit };
}

function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(([, label]) => esc(label)).join(',');
  const lines = rows.map((row) => columns.map(([key]) => esc(row[key])).join(','));
  return `﻿${[header, ...lines].join('\r\n')}`;
}

async function fetchOne(cfg, id, conn = pool) {
  const [rows] = await conn.query(`SELECT ${cfg.select} FROM ${cfg.from} WHERE ${cfg.pk} = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

/* ============================================================
 * AUTH MIDDLEWARE
 * ============================================================ */
const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Silakan login terlebih dahulu'));
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return next(new HttpError(401, 'Sesi berakhir, silakan login kembali'));
  }
};

const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Anda tidak memiliki akses untuk aksi ini'));

/* ============================================================
 * CRUD FACTORY
 * ============================================================ */
const router = express.Router();

function registerCrud(raw) {
  const cfg = { pk: 't.id', ...raw };
  const roles = { read: ROLES, write: ['admin', 'petugas'], remove: ['admin', 'petugas'], ...(raw.roles || {}) };
  const base = `/${cfg.path}`;

  router.get(base, auth, allow(...roles.read), wrap(async (req, res) => {
    const { rows, total, page, limit } = await runList(cfg, req.query, { user: req.user });
    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  }));

  router.get(`${base}/export`, auth, allow(...roles.read), wrap(async (req, res) => {
    const { rows } = await runList(cfg, req.query, { all: true, user: req.user });
    const columns = cfg.exportColumns || Object.keys(rows[0] || {}).map((k) => [k, k]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cfg.path}-${todayStr()}.csv"`);
    res.send(toCsv(rows, columns));
  }));

  router.get(`${base}/:id`, auth, allow(...roles.read), wrap(async (req, res) => {
    const row = await fetchOne(cfg, parseId(req.params.id));
    if (!row) throw new HttpError(404, 'Data tidak ditemukan');
    if (req.user.role === 'unit' && cfg.unitColumn && row.unit_id && row.unit_id !== req.user.unit_id) {
      throw new HttpError(403, 'Anda tidak memiliki akses ke data unit lain');
    }
    res.json({ success: true, data: row });
  }));

  if (cfg.readOnly) return;

  const fields = cfg.fields || [];
  const updatable = fields.filter((f) => !f.createOnly);

  if (!cfg.noCreate) {
    router.post(base, auth, allow(...roles.write), wrap(async (req, res) => {
      const data = validate(fields, req.body);
      const ctx = { body: req.body || {}, user: req.user };
      if (req.user.role === 'unit' && cfg.unitColumn) {
        data.unit_id = req.user.unit_id;
      }
      const id = await withTx(async (conn) => {
        if (cfg.beforeCreate) await cfg.beforeCreate(conn, data, ctx);
        const [result] = await conn.query('INSERT INTO ?? SET ?', [cfg.table, data]);
        if (cfg.afterCreate) await cfg.afterCreate(conn, result.insertId, data, ctx);
        return result.insertId;
      });
      res.status(201).json({ success: true, message: cfg.createdMessage || 'Data berhasil disimpan', data: await fetchOne(cfg, id) });
    }));
  }

  if (!cfg.noUpdate) {
    router.put(`${base}/:id`, auth, allow(...roles.write), wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const data = validate(updatable, req.body, { partial: true });
      const ctx = { body: req.body || {}, user: req.user };
      await withTx(async (conn) => {
        const [[existing]] = await conn.query('SELECT * FROM ?? WHERE id = ? FOR UPDATE', [cfg.table, id]);
        if (!existing) throw new HttpError(404, 'Data tidak ditemukan');
        if (req.user.role === 'unit' && cfg.unitColumn && existing.unit_id && existing.unit_id !== req.user.unit_id) {
          throw new HttpError(403, 'Anda tidak memiliki akses untuk mengubah data unit lain');
        }
        if (cfg.beforeUpdate) await cfg.beforeUpdate(conn, data, ctx, existing);
        if (!Object.keys(data).length) throw new HttpError(422, 'Tidak ada data yang diubah');
        await conn.query('UPDATE ?? SET ? WHERE id = ?', [cfg.table, data, id]);
        if (cfg.afterUpdate) await cfg.afterUpdate(conn, id, data, ctx, existing);
      });
      res.json({ success: true, message: 'Data berhasil diperbarui', data: await fetchOne(cfg, id) });
    }));
  }

  if (!cfg.noDelete) {
    router.delete(`${base}/:id`, auth, allow(...roles.remove), wrap(async (req, res) => {
      const id = parseId(req.params.id);
      if (req.user.role === 'unit') {
        throw new HttpError(403, 'Unit luar tidak memiliki izin untuk menghapus data');
      }
      await withTx(async (conn) => {
        const [[existing]] = await conn.query('SELECT * FROM ?? WHERE id = ? FOR UPDATE', [cfg.table, id]);
        if (!existing) throw new HttpError(404, 'Data tidak ditemukan');
        if (cfg.beforeDelete) await cfg.beforeDelete(conn, existing, { user: req.user });
        await conn.query('DELETE FROM ?? WHERE id = ?', [cfg.table, id]);
      });
      res.json({ success: true, message: 'Data berhasil dihapus' });
    }));
  }
}

/* ============================================================
 * PROCESS HELPERS
 * ============================================================ */
async function getReceipt(conn, id) {
  const [[receipt]] = await conn.query('SELECT * FROM dirty_receipts WHERE id = ? FOR UPDATE', [id]);
  if (!receipt) throw new HttpError(404, 'Data alat kotor tidak ditemukan');
  if (receipt.status === 'Karantina') throw new HttpError(409, 'Alat sedang dikarantina, proses tidak dapat dilanjutkan');
  return receipt;
}

const STOCK_STATUS_SQL = "(CASE WHEN t.status = 'Tersedia' AND t.expiry_date < CURDATE() THEN 'Kedaluwarsa' ELSE t.status END)";

/* ============================================================
 * RESOURCES
 * ============================================================ */
const MASTER_ROLES = { write: ['admin'], remove: ['admin'] };

// ---------- Users ----------
registerCrud({
  path: 'users',
  table: 'users',
  from: 'users t LEFT JOIN units u ON u.id = t.unit_id',
  select: 't.id, t.name, t.username, t.role, t.unit_id, t.is_active, t.created_at, u.name AS unit_name',
  search: ['t.name', 't.username', 'u.name'],
  sort: { id: 't.id', name: 't.name', username: 't.username', role: 't.role', unit_name: 'u.name', created_at: 't.created_at' },
  defaultSort: 'id',
  filters: { role: 't.role', unit_id: 't.unit_id', is_active: 't.is_active' },
  exportColumns: [['name', 'Nama'], ['username', 'Username'], ['role', 'Role'], ['unit_name', 'Unit'], ['is_active', 'Aktif']],
  roles: { read: ['admin'], write: ['admin'], remove: ['admin'] },
  fields: [
    field('name', 'string', { required: true, label: 'Nama', max: 100 }),
    field('username', 'string', { required: true, label: 'Username', min: 3, max: 50, createOnly: true }),
    field('password', 'string', { required: true, label: 'Password', min: 6, max: 72 }),
    field('role', 'enum', { values: ROLES, default: 'petugas', label: 'Role' }),
    field('unit_id', 'int', { label: 'Unit (Wajib jika Role Unit)', min: 1 }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
  async beforeCreate(conn, data) {
    data.password = await bcrypt.hash(data.password, 10);
  },
  async beforeUpdate(conn, data, ctx, existing) {
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    else delete data.password;
    if (existing.id === ctx.user.id && (data.is_active === 0 || (data.role && data.role !== 'admin'))) {
      throw new HttpError(409, 'Anda tidak dapat menonaktifkan atau menurunkan role akun sendiri');
    }
  },
  async beforeDelete(conn, existing, ctx) {
    if (existing.id === ctx.user.id) throw new HttpError(409, 'Anda tidak dapat menghapus akun sendiri');
  },
});

// ---------- Master: Unit ----------
registerCrud({
  path: 'units',
  table: 'units',
  from: 'units t',
  select: 't.*',
  search: ['t.code', 't.name', 't.pic_name'],
  sort: { id: 't.id', code: 't.code', name: 't.name', pic_name: 't.pic_name', created_at: 't.created_at' },
  defaultSort: 'id',
  filters: { is_active: 't.is_active' },
  exportColumns: [['code', 'Kode'], ['name', 'Nama Unit'], ['pic_name', 'Penanggung Jawab'], ['phone', 'Telepon'], ['is_active', 'Aktif']],
  roles: MASTER_ROLES,
  fields: [
    field('code', 'string', { required: true, label: 'Kode', max: 20 }),
    field('name', 'string', { required: true, label: 'Nama unit', max: 100 }),
    field('pic_name', 'string', { label: 'Penanggung jawab', max: 100 }),
    field('phone', 'string', { label: 'Telepon', max: 30 }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
});

// ---------- Master: Jenis Alat ----------
registerCrud({
  path: 'items',
  table: 'items',
  from: 'items t',
  select: 't.*',
  search: ['t.code', 't.name', 't.description', 't.unit_label', 't.process_type'],
  sort: { id: 't.id', code: 't.code', name: 't.name', process_type: 't.process_type', category: 't.category', unit_label: 't.unit_label', created_at: 't.created_at' },
  defaultSort: 'id',
  filters: { process_type: 't.process_type', category: 't.category', is_active: 't.is_active' },
  exportColumns: [['code', 'Kode'], ['name', 'Nama'], ['process_type', 'Kategori Proses'], ['category', 'Kategori Kemasan'], ['unit_label', 'Satuan Standar'], ['shelf_life_months', 'Masa Steril (bulan)'], ['is_active', 'Aktif']],
  roles: MASTER_ROLES,
  fields: [
    field('code', 'string', { required: true, label: 'Kode', max: 30 }),
    field('name', 'string', { required: true, label: 'Nama alat', max: 150 }),
    field('process_type', 'enum', { values: ['Steril', 'DTT'], default: 'Steril', label: 'Kategori Proses' }),
    field('category', 'enum', { values: PACKAGE_TYPES, required: true, label: 'Kategori' }),
    field('unit_label', 'string', { default: 'Set', label: 'Satuan Standar', max: 50 }),
    field('shelf_life_months', 'int', { min: 1, max: 60, default: DEFAULT_SHELF_LIFE_MONTHS, label: 'Masa steril (bulan)' }),
    field('photo', 'path', { label: 'Foto' }),
    field('description', 'string', { label: 'Keterangan' }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
});

// ---------- Master: Mesin ----------
registerCrud({
  path: 'machines',
  table: 'machines',
  from: 'machines t',
  select: 't.*',
  search: ['t.code', 't.name', 't.type'],
  sort: { id: 't.id', code: 't.code', name: 't.name', type: 't.type' },
  defaultSort: 'id',
  filters: { type: 't.type', is_active: 't.is_active' },
  exportColumns: [['code', 'Kode'], ['name', 'Nama Mesin'], ['type', 'Tipe'], ['is_active', 'Aktif']],
  roles: MASTER_ROLES,
  fields: [
    field('code', 'string', { required: true, label: 'Kode', max: 10 }),
    field('name', 'string', { required: true, label: 'Nama mesin', max: 100 }),
    field('type', 'string', { required: true, label: 'Tipe mesin', max: 50 }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
});

// ---------- Master: Petugas CSSD ----------
registerCrud({
  path: 'officers',
  table: 'officers',
  from: 'officers t',
  select: 't.*',
  search: ['t.nip', 't.name', 't.role', 't.phone'],
  sort: { id: 't.id', nip: 't.nip', name: 't.name', role: 't.role', created_at: 't.created_at' },
  defaultSort: 'id',
  filters: { is_active: 't.is_active' },
  exportColumns: [['nip', 'NIP'], ['name', 'Nama Petugas'], ['role', 'Jabatan / Peran'], ['phone', 'Telepon'], ['is_active', 'Aktif']],
  roles: MASTER_ROLES,
  fields: [
    field('nip', 'string', { label: 'NIP / ID', max: 50 }),
    field('name', 'string', { required: true, label: 'Nama petugas', max: 100 }),
    field('role', 'string', { default: 'Petugas CSSD', label: 'Jabatan / Peran', max: 50 }),
    field('phone', 'string', { label: 'Telepon', max: 30 }),
    field('signature', 'path', { label: 'Tanda tangan' }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
});

// ---------- Master: Bahan Kemasan ----------
registerCrud({
  path: 'packaging-materials',
  table: 'packaging_materials',
  from: 'packaging_materials t',
  select: 't.*',
  search: ['t.code', 't.name', 't.description'],
  sort: { id: 't.id', code: 't.code', name: 't.name', is_active: 't.is_active' },
  defaultSort: 'name',
  filters: { is_active: 't.is_active' },
  exportColumns: [['code', 'Kode'], ['name', 'Nama Bahan'], ['description', 'Keterangan'], ['is_active', 'Aktif']],
  roles: MASTER_ROLES,
  fields: [
    field('code', 'string', { required: true, label: 'Kode', max: 30 }),
    field('name', 'string', { required: true, label: 'Nama bahan kemasan', max: 100 }),
    field('description', 'string', { label: 'Keterangan', max: 255 }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
});

// ---------- Master: Satuan (Item Units) ----------
registerCrud({
  path: 'item-units',
  table: 'item_units',
  from: 'item_units t',
  select: 't.*',
  search: ['t.code', 't.name', 't.category', 't.description'],
  sort: { id: 't.id', code: 't.code', name: 't.name', category: 't.category', is_active: 't.is_active' },
  defaultSort: 'name',
  filters: { category: 't.category', is_active: 't.is_active' },
  exportColumns: [['code', 'Kode'], ['name', 'Nama Satuan'], ['category', 'Kategori Penggunaan'], ['description', 'Keterangan'], ['is_active', 'Aktif']],
  roles: { read: ['admin', 'petugas', 'unit'], write: ['admin'], remove: ['admin'] },
  fields: [
    field('code', 'string', { required: true, label: 'Kode', max: 20 }),
    field('name', 'string', { required: true, label: 'Nama Satuan', max: 50 }),
    field('category', 'enum', { values: ['Semua', 'Steril', 'DTT'], default: 'Semua', label: 'Kategori Penggunaan' }),
    field('description', 'string', { label: 'Keterangan', max: 255 }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
});

// ---------- Tahap 1: Alat Kotor Masuk (barcode) ----------
registerCrud({
  path: 'dirty-receipts',
  table: 'dirty_receipts',
  from: 'dirty_receipts t LEFT JOIN units u ON u.id = t.unit_id',
  select: 't.*, u.name AS unit_name, u.code AS unit_code',
  search: ['t.barcode', 't.item_name', 'u.name', 't.sender_name', 't.receiver_name'],
  sort: { id: 't.id', barcode: 't.barcode', receipt_date: 't.receipt_date', item_name: 't.item_name', quantity: 't.quantity', unit_name: 'u.name', status: 't.status', stage: 't.stage' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { unit_id: 't.unit_id', status: 't.status', stage: 't.stage', barcode: 't.barcode' },
  dateColumn: 't.receipt_date',
  exportColumns: [['barcode', 'Barcode'], ['receipt_date', 'Tanggal'], ['unit_name', 'Unit Asal'], ['item_name', 'Jenis Alat'], ['quantity', 'Jumlah'], ['unit_label', 'Satuan'], ['sender_name', 'Petugas Penyerah'], ['receiver_name', 'Petugas Penerima'], ['stage', 'Tahap'], ['status', 'Status']],
  roles: { read: ['admin', 'petugas', 'unit'], write: ['admin', 'petugas', 'unit'], remove: ['admin', 'petugas'] },
  fields: [
    field('barcode', 'string', { label: 'Barcode', max: 50, createOnly: true }),
    field('receipt_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('unit_id', 'int', { required: true, min: 1, label: 'Unit asal' }),
    field('item_id', 'int', { min: 1, label: 'Jenis alat' }),
    field('item_name', 'string', { required: true, label: 'Nama alat', max: 150 }),
    field('quantity', 'int', { required: true, min: 1, label: 'Jumlah' }),
    field('unit_label', 'string', { default: 'set', max: 30, label: 'Satuan' }),
    field('sender_name', 'string', { required: true, label: 'Petugas penyerah', max: 100 }),
    field('sender_signature', 'path', { label: 'TTD penyerah' }),
    field('receiver_name', 'string', { required: true, label: 'Petugas penerima', max: 100 }),
    field('receiver_signature', 'path', { label: 'TTD penerima' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    data.barcode = data.barcode || (await makeCode(conn, 'AK', data.receipt_date));
    data.stage = 1;
    data.status = 'Diterima';
    data.created_by = ctx.user.id;
  },
  async beforeDelete(conn, existing) {
    // Bersihkan data relasi proses terkait agar penghapusan konsisten
    await conn.query('DELETE FROM washings WHERE receipt_id = ?', [existing.id]);
    await conn.query('DELETE FROM dryings WHERE receipt_id = ?', [existing.id]);
    const [pkgs] = await conn.query('SELECT id FROM packagings WHERE receipt_id = ?', [existing.id]);
    if (pkgs.length) {
      const pkgIds = pkgs.map((p) => p.id);
      await conn.query('DELETE FROM sterile_stock WHERE packaging_id IN (?)', [pkgIds]);
      await conn.query('DELETE FROM quarantines WHERE packaging_id IN (?)', [pkgIds]);
      await conn.query('DELETE FROM sterilization_items WHERE packaging_id IN (?)', [pkgIds]);
      await conn.query('DELETE FROM packagings WHERE id IN (?)', [pkgIds]);
    }
  },
});

// ---------- Tahap 2: Pencucian ----------
registerCrud({
  path: 'washings',
  table: 'washings',
  from: 'washings t JOIN dirty_receipts r ON r.id = t.receipt_id LEFT JOIN units u ON u.id = r.unit_id',
  select: 't.*, r.barcode AS receipt_barcode, r.item_name, u.name AS unit_name',
  search: ['r.barcode', 'r.item_name', 't.officer', 't.liquid'],
  sort: { id: 't.id', wash_date: 't.wash_date', receipt_barcode: 'r.barcode', item_name: 'r.item_name', method: 't.method', officer: 't.officer' },
  defaultSort: 'id',
  filters: { method: 't.method', receipt_id: 't.receipt_id' },
  dateColumn: 't.wash_date',
  exportColumns: [['wash_date', 'Tanggal'], ['receipt_barcode', 'Barcode Alat Kotor'], ['item_name', 'Jenis Alat'], ['unit_name', 'Unit Asal'], ['method', 'Metode'], ['liquid', 'Cairan'], ['duration_min', 'Waktu (menit)'], ['officer', 'Petugas']],
  fields: [
    field('receipt_id', 'int', { required: true, min: 1, label: 'Alat kotor', createOnly: true }),
    field('method', 'enum', { values: ['Washer', 'Manual', 'Ultrasonik'], default: 'Washer', label: 'Metode' }),
    field('liquid', 'string', { label: 'Cairan', max: 100 }),
    field('duration_min', 'int', { min: 1, max: 600, label: 'Waktu (menit)' }),
    field('officer', 'string', { required: true, label: 'Petugas', max: 100 }),
    field('wash_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data) {
    const receipt = await getReceipt(conn, data.receipt_id);
    if (receipt.stage > 3 || receipt.status === 'Selesai') throw new HttpError(409, 'Alat sudah melewati tahap pencucian');
  },
  async afterCreate(conn, id, data) {
    await conn.query("UPDATE dirty_receipts SET stage = GREATEST(stage, 2), status = 'Proses' WHERE id = ?", [data.receipt_id]);
  },
  async afterDelete(conn, existing) {
    const [remaining] = await conn.query('SELECT id FROM washings WHERE receipt_id = ?', [existing.receipt_id]);
    if (!remaining.length) {
      const [dryings] = await conn.query('SELECT id FROM dryings WHERE receipt_id = ?', [existing.receipt_id]);
      if (!dryings.length) {
        await conn.query("UPDATE dirty_receipts SET stage = 1, status = 'Diterima' WHERE id = ?", [existing.receipt_id]);
      }
    }
  },
});

// ---------- Tahap 3: Pengeringan & Pemeriksaan ----------
registerCrud({
  path: 'dryings',
  table: 'dryings',
  from: 'dryings t JOIN dirty_receipts r ON r.id = t.receipt_id LEFT JOIN units u ON u.id = r.unit_id',
  select: 't.*, r.barcode AS receipt_barcode, r.item_name, u.name AS unit_name',
  search: ['r.barcode', 'r.item_name', 't.officer'],
  sort: { id: 't.id', dry_date: 't.dry_date', receipt_barcode: 'r.barcode', item_name: 'r.item_name', officer: 't.officer' },
  defaultSort: 'id',
  filters: { receipt_id: 't.receipt_id', is_dry: 't.is_dry', no_rust: 't.no_rust', function_ok: 't.function_ok' },
  dateColumn: 't.dry_date',
  exportColumns: [['dry_date', 'Tanggal'], ['receipt_barcode', 'Barcode Alat Kotor'], ['item_name', 'Jenis Alat'], ['is_dry', 'Kering Sempurna'], ['no_rust', 'Tidak Berkarat'], ['function_ok', 'Fungsi Baik'], ['officer', 'Petugas']],
  fields: [
    field('receipt_id', 'int', { required: true, min: 1, label: 'Alat kotor', createOnly: true }),
    field('is_dry', 'bool', { default: 0, label: 'Alat kering sempurna' }),
    field('no_rust', 'bool', { default: 0, label: 'Tidak ada karat / noda' }),
    field('function_ok', 'bool', { default: 0, label: 'Fungsi alat baik' }),
    field('officer', 'string', { required: true, label: 'Petugas', max: 100 }),
    field('dry_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data) {
    const receipt = await getReceipt(conn, data.receipt_id);
    if (receipt.stage < 2) throw new HttpError(409, 'Alat belum melalui tahap pencucian');
    if (receipt.stage > 3 || receipt.status === 'Selesai') throw new HttpError(409, 'Alat sudah melewati tahap pengeringan');
  },
  async afterCreate(conn, id, data) {
    const passed = data.is_dry && data.no_rust && data.function_ok;
    // Gagal pemeriksaan -> kembali ke tahap pencucian (cuci ulang)
    await conn.query("UPDATE dirty_receipts SET stage = ?, status = 'Proses' WHERE id = ?", [passed ? 3 : 2, data.receipt_id]);
  },
  async afterUpdate(conn, id, data, ctx, existing) {
    const passed = (data.is_dry ?? existing.is_dry) && (data.no_rust ?? existing.no_rust) && (data.function_ok ?? existing.function_ok);
    await conn.query("UPDATE dirty_receipts SET stage = ?, status = 'Proses' WHERE id = ?", [passed ? 3 : 2, existing.receipt_id]);
  },
  async afterDelete(conn, existing) {
    const [remaining] = await conn.query('SELECT id FROM dryings WHERE receipt_id = ?', [existing.receipt_id]);
    if (!remaining.length) {
      await conn.query("UPDATE dirty_receipts SET stage = 2, status = 'Proses' WHERE id = ?", [existing.receipt_id]);
    }
  },
});

// ---------- Tahap 4: Pengemasan ----------
registerCrud({
  path: 'packagings',
  table: 'packagings',
  from: 'packagings t JOIN dirty_receipts r ON r.id = t.receipt_id LEFT JOIN units u ON u.id = r.unit_id',
  select: 't.*, r.barcode AS receipt_barcode, r.item_name, u.name AS unit_name',
  search: ['t.barcode', 'r.barcode', 'r.item_name', 't.material', 't.officer'],
  sort: { id: 't.id', pack_date: 't.pack_date', barcode: 't.barcode', item_name: 'r.item_name', package_type: 't.package_type', quantity: 't.quantity', status: 't.status' },
  defaultSort: 'id',
  filters: { package_type: 't.package_type', status: 't.status', receipt_id: 't.receipt_id', barcode: 't.barcode' },
  dateColumn: 't.pack_date',
  exportColumns: [['pack_date', 'Tanggal'], ['barcode', 'Label Barcode'], ['receipt_barcode', 'Barcode Alat Kotor'], ['item_name', 'Jenis Alat'], ['package_type', 'Jenis Kemasan'], ['material', 'Bahan Kemasan'], ['quantity', 'Jumlah'], ['unit_label', 'Satuan'], ['officer', 'Petugas'], ['status', 'Status']],
  fields: [
    field('receipt_id', 'int', { required: true, min: 1, label: 'Alat kotor', createOnly: true }),
    field('package_type', 'enum', { values: PACKAGE_TYPES, required: true, label: 'Jenis kemasan', createOnly: true }),
    field('material', 'string', { required: true, label: 'Bahan kemasan', max: 80 }),
    field('barcode', 'string', { label: 'Label barcode', max: 50, createOnly: true }),
    field('quantity', 'int', { required: true, min: 1, label: 'Jumlah' }),
    field('unit_label', 'string', { default: 'paket', max: 30, label: 'Satuan' }),
    field('officer', 'string', { required: true, label: 'Petugas', max: 100 }),
    field('pack_date', 'date', { default: todayStr, label: 'Tanggal' }),
  ],
  async beforeCreate(conn, data) {
    const receipt = await getReceipt(conn, data.receipt_id);
    if (receipt.stage < 3) throw new HttpError(409, 'Alat belum selesai tahap pengeringan & pemeriksaan');
    if (receipt.stage > 5 || receipt.status === 'Selesai') throw new HttpError(409, 'Alat sudah selesai diproses');
    const [ok] = await conn.query('SELECT id FROM dryings WHERE receipt_id = ? AND is_dry = 1 AND no_rust = 1 AND function_ok = 1 LIMIT 1', [receipt.id]);
    if (!ok.length) throw new HttpError(409, 'Pemeriksaan pengeringan belum lolos');
    data.barcode = data.barcode || (await makeCode(conn, PREFIX_BY_TYPE[data.package_type], data.pack_date));
    data.status = 'Dikemas';
  },
  async afterCreate(conn, id, data) {
    await conn.query("UPDATE dirty_receipts SET stage = GREATEST(stage, 4), status = 'Proses' WHERE id = ?", [data.receipt_id]);
  },
  async beforeDelete(conn, existing) {
    await conn.query('DELETE FROM sterilization_items WHERE packaging_id = ?', [existing.id]);
    await conn.query('DELETE FROM sterile_stock WHERE packaging_id = ?', [existing.id]);
    await conn.query('DELETE FROM quarantines WHERE packaging_id = ?', [existing.id]);
  },
  async afterDelete(conn, existing) {
    const [remaining] = await conn.query('SELECT id FROM packagings WHERE receipt_id = ?', [existing.receipt_id]);
    if (!remaining.length) {
      await conn.query("UPDATE dirty_receipts SET stage = 3, status = 'Proses' WHERE id = ?", [existing.receipt_id]);
    }
  },
});

// ---------- Tahap 5: Sterilisasi ----------
registerCrud({
  path: 'sterilizations',
  table: 'sterilizations',
  from: 'sterilizations t JOIN machines m ON m.id = t.machine_id',
  select: 't.*, m.name AS machine_name, m.code AS machine_code, (SELECT COUNT(*) FROM sterilization_items si WHERE si.sterilization_id = t.id) AS total_packages',
  search: ['t.batch_no', 't.cycle_no', 'm.name', 't.officer'],
  sort: { id: 't.id', steril_date: 't.steril_date', batch_no: 't.batch_no', cycle_no: 't.cycle_no', machine_name: 'm.name', status: 't.status' },
  defaultSort: 'id',
  filters: { machine_id: 't.machine_id', status: 't.status' },
  dateColumn: 't.steril_date',
  exportColumns: [['steril_date', 'Tanggal'], ['machine_name', 'Mesin'], ['cycle_no', 'No. Siklus'], ['batch_no', 'No. Batch'], ['temperature', 'Suhu (C)'], ['duration_min', 'Waktu (menit)'], ['total_packages', 'Jumlah Paket'], ['officer', 'Petugas'], ['status', 'Status']],
  fields: [
    field('machine_id', 'int', { required: true, min: 1, label: 'Mesin' }),
    field('cycle_no', 'string', { label: 'No. siklus', max: 20 }),
    field('batch_no', 'string', { label: 'No. batch', max: 50 }),
    field('temperature', 'int', { required: true, min: 50, max: 200, label: 'Suhu (C)' }),
    field('duration_min', 'int', { required: true, min: 1, max: 600, label: 'Waktu (menit)' }),
    field('officer', 'string', { required: true, label: 'Petugas', max: 100 }),
    field('steril_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    const ids = Array.isArray(ctx.body.package_ids) ? [...new Set(ctx.body.package_ids.map(Number))] : [];
    if (!ids.length || ids.some((n) => !Number.isInteger(n) || n < 1)) {
      throw new HttpError(422, 'Pilih minimal satu paket untuk disterilkan', { package_ids: 'Pilih minimal satu paket' });
    }
    const [[machine]] = await conn.query('SELECT * FROM machines WHERE id = ? AND is_active = 1', [data.machine_id]);
    if (!machine) throw new HttpError(422, 'Mesin tidak ditemukan atau tidak aktif', { machine_id: 'Mesin tidak valid' });

    const [packages] = await conn.query("SELECT id FROM packagings WHERE id IN (?) AND status = 'Dikemas' FOR UPDATE", [ids]);
    if (packages.length !== ids.length) throw new HttpError(409, 'Sebagian paket tidak tersedia atau sudah disterilkan', { package_ids: 'Paket tidak valid' });

    const cycle = data.cycle_no || pad(await nextCounter(conn, `CYCLE-${machine.code}`));
    data.cycle_no = cycle;
    data.batch_no = data.batch_no || `${machine.code}-${ddmmyy(data.steril_date)}-${cycle}`;
    data.status = 'Menunggu Verifikasi';
    ctx.packageIds = ids;
  },
  async afterCreate(conn, id, data, ctx) {
    await conn.query('INSERT INTO sterilization_items (sterilization_id, packaging_id) VALUES ?', [ctx.packageIds.map((pid) => [id, pid])]);
    await conn.query("UPDATE packagings SET status = 'Disterilkan' WHERE id IN (?)", [ctx.packageIds]);
    await conn.query(
      "UPDATE dirty_receipts SET stage = GREATEST(stage, 5), status = 'Proses' WHERE id IN (SELECT DISTINCT receipt_id FROM packagings WHERE id IN (?))",
      [ctx.packageIds]
    );
  },
  async beforeDelete(conn, existing) {
    const [items] = await conn.query('SELECT packaging_id FROM sterilization_items WHERE sterilization_id = ?', [existing.id]);
    if (items.length) {
      const pids = items.map((i) => i.packaging_id);
      await conn.query('DELETE FROM sterile_stock WHERE packaging_id IN (?)', [pids]);
      await conn.query('DELETE FROM quarantines WHERE packaging_id IN (?)', [pids]);
      await conn.query("UPDATE packagings SET status = 'Dikemas' WHERE id IN (?)", [pids]);
      await conn.query(
        "UPDATE dirty_receipts SET stage = 4, status = 'Proses' WHERE id IN (SELECT DISTINCT receipt_id FROM packagings WHERE id IN (?))",
        [pids]
      );
    }
    await conn.query('DELETE FROM verifications WHERE sterilization_id = ?', [existing.id]);
    await conn.query('DELETE FROM sterilization_items WHERE sterilization_id = ?', [existing.id]);
  },
});

// ---------- Tahap 6: Verifikasi Sterilisasi ----------
registerCrud({
  path: 'verifications',
  table: 'verifications',
  from: 'verifications t JOIN sterilizations s ON s.id = t.sterilization_id JOIN machines m ON m.id = s.machine_id',
  select: 't.*, s.batch_no, s.cycle_no, m.name AS machine_name',
  search: ['s.batch_no', 's.cycle_no', 't.officer', 'm.name'],
  sort: { id: 't.id', verify_date: 't.verify_date', batch_no: 's.batch_no', result: 't.result', officer: 't.officer' },
  defaultSort: 'id',
  filters: { result: 't.result', sterilization_id: 't.sterilization_id' },
  dateColumn: 't.verify_date',
  exportColumns: [['verify_date', 'Tanggal'], ['batch_no', 'No. Batch'], ['machine_name', 'Mesin'], ['condition_packaging', 'Kondisi Kemasan'], ['chem_internal', 'Indikator Kimia Internal'], ['chem_external', 'Indikator Kimia Eksternal'], ['bio_indicator', 'Indikator Biologi'], ['bowie_dick', 'Bowie-Dick Test'], ['result', 'Hasil'], ['fail_reason', 'Alasan Gagal'], ['officer', 'Petugas']],
  createdMessage: 'Verifikasi tersimpan, status alat diperbarui otomatis',
  fields: [
    field('sterilization_id', 'int', { required: true, min: 1, label: 'Batch sterilisasi' }),
    field('condition_packaging', 'enum', { values: ['Baik', 'Rusak'], required: true, label: 'Kondisi kemasan' }),
    field('chem_internal', 'enum', { values: INDICATOR, required: true, label: 'Indikator kimia internal' }),
    field('chem_external', 'enum', { values: INDICATOR, required: true, label: 'Indikator kimia eksternal' }),
    field('bio_indicator', 'enum', { values: INDICATOR, required: true, label: 'Indikator biologi (BI)' }),
    field('bowie_dick', 'enum', { values: INDICATOR, required: true, label: 'Bowie-Dick test' }),
    field('officer', 'string', { required: true, label: 'Petugas', max: 100 }),
    field('signature', 'path', { label: 'TTD verifikasi' }),
    field('verify_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    const [[steril]] = await conn.query('SELECT * FROM sterilizations WHERE id = ? FOR UPDATE', [data.sterilization_id]);
    if (!steril) throw new HttpError(404, 'Batch sterilisasi tidak ditemukan', { sterilization_id: 'Batch tidak ditemukan' });
    if (steril.status !== 'Menunggu Verifikasi') throw new HttpError(409, 'Batch ini sudah diverifikasi', { sterilization_id: 'Batch sudah diverifikasi' });
    ctx.sterilization = steril;

    const reasons = [];
    if (data.condition_packaging === 'Rusak') reasons.push('Kondisi kemasan rusak');
    if (data.chem_internal !== 'Sesuai') reasons.push('Indikator kimia internal tidak sesuai');
    if (data.chem_external !== 'Sesuai') reasons.push('Indikator kimia eksternal tidak sesuai');
    if (data.bio_indicator !== 'Sesuai') reasons.push('Indikator biologi (BI) tidak sesuai');
    if (data.bowie_dick !== 'Sesuai') reasons.push('Bowie-Dick test tidak sesuai');
    data.result = reasons.length ? 'GAGAL' : 'LULUS';
    data.fail_reason = reasons.length ? reasons.join('; ') : null;
  },
  async afterCreate(conn, id, data, ctx) {
    const steril = ctx.sterilization;
    const [packages] = await conn.query(
      `SELECT p.*, r.item_name, r.item_id FROM sterilization_items si
       JOIN packagings p ON p.id = si.packaging_id
       JOIN dirty_receipts r ON r.id = p.receipt_id
       WHERE si.sterilization_id = ?`,
      [steril.id]
    );
    const receiptIds = [...new Set(packages.map((p) => p.receipt_id))];

    if (data.result === 'LULUS') {
      for (const pkg of packages) {
        let months = DEFAULT_SHELF_LIFE_MONTHS;
        if (pkg.item_id) {
          const [[item]] = await conn.query('SELECT shelf_life_months FROM items WHERE id = ?', [pkg.item_id]);
          if (item) months = item.shelf_life_months;
        }
        await conn.query('INSERT INTO sterile_stock SET ?', [{
          packaging_id: pkg.id,
          barcode: pkg.barcode,
          category: pkg.package_type,
          item_name: pkg.item_name,
          batch_no: steril.batch_no,
          sterile_date: steril.steril_date,
          expiry_date: addMonths(steril.steril_date, months),
          quantity: pkg.quantity,
          unit_label: pkg.unit_label,
          status: 'Tersedia',
        }]);
      }
      await conn.query("UPDATE packagings SET status = 'Lulus' WHERE id IN (?)", [packages.map((p) => p.id)]);
      await conn.query("UPDATE sterilizations SET status = 'Lulus' WHERE id = ?", [steril.id]);
      await conn.query("UPDATE dirty_receipts SET stage = 6, status = 'Selesai' WHERE id IN (?)", [receiptIds]);
    } else {
      for (const pkg of packages) {
        await conn.query('INSERT INTO quarantines SET ?', [{
          packaging_id: pkg.id,
          verification_id: id,
          barcode: pkg.barcode,
          batch_no: steril.batch_no,
          reason: data.fail_reason,
          status: 'Karantina',
        }]);
      }
      await conn.query("UPDATE packagings SET status = 'Karantina' WHERE id IN (?)", [packages.map((p) => p.id)]);
      await conn.query("UPDATE sterilizations SET status = 'Gagal' WHERE id = ?", [steril.id]);
      await conn.query("UPDATE dirty_receipts SET stage = 6, status = 'Karantina' WHERE id IN (?)", [receiptIds]);
    }
  },
  async beforeDelete(conn, existing) {
    await conn.query("UPDATE sterilizations SET status = 'Menunggu Verifikasi' WHERE id = ?", [existing.sterilization_id]);
    const [items] = await conn.query('SELECT packaging_id FROM sterilization_items WHERE sterilization_id = ?', [existing.sterilization_id]);
    if (items.length) {
      const pids = items.map((i) => i.packaging_id);
      await conn.query('DELETE FROM sterile_stock WHERE packaging_id IN (?)', [pids]);
      await conn.query('DELETE FROM quarantines WHERE verification_id = ? OR packaging_id IN (?)', [existing.id, pids]);
      await conn.query("UPDATE packagings SET status = 'Disterilkan' WHERE id IN (?)", [pids]);
      await conn.query(
        "UPDATE dirty_receipts SET stage = 5, status = 'Proses' WHERE id IN (SELECT DISTINCT receipt_id FROM packagings WHERE id IN (?))",
        [pids]
      );
    }
  },
  async afterUpdate(conn, id, data, ctx, existing) {
    const [fresh] = await conn.query('SELECT * FROM verifications WHERE id = ?', [id]);
    if (fresh.length) {
      const row = fresh[0];
      const reasons = [];
      if (row.condition_packaging === 'Rusak') reasons.push('Kondisi kemasan rusak');
      if (row.chem_internal !== 'Sesuai') reasons.push('Indikator kimia internal tidak sesuai');
      if (row.chem_external !== 'Sesuai') reasons.push('Indikator kimia eksternal tidak sesuai');
      if (row.bio_indicator !== 'Sesuai') reasons.push('Indikator biologi (BI) tidak sesuai');
      if (row.bowie_dick !== 'Sesuai') reasons.push('Bowie-Dick test tidak sesuai');
      const nextResult = reasons.length ? 'GAGAL' : 'LULUS';
      const failReason = reasons.length ? reasons.join('; ') : null;

      if (row.result !== nextResult) {
        await conn.query('UPDATE verifications SET result = ?, fail_reason = ? WHERE id = ?', [nextResult, failReason, id]);
        const [[steril]] = await conn.query('SELECT * FROM sterilizations WHERE id = ?', [row.sterilization_id]);
        const [packages] = await conn.query(
          `SELECT p.*, r.item_name, r.item_id FROM sterilization_items si
           JOIN packagings p ON p.id = si.packaging_id
           JOIN dirty_receipts r ON r.id = p.receipt_id
           WHERE si.sterilization_id = ?`,
          [steril.id]
        );
        const receiptIds = [...new Set(packages.map((p) => p.receipt_id))];

        if (nextResult === 'LULUS') {
          await conn.query('DELETE FROM quarantines WHERE verification_id = ?', [id]);
          for (const pkg of packages) {
            let months = DEFAULT_SHELF_LIFE_MONTHS;
            if (pkg.item_id) {
              const [[item]] = await conn.query('SELECT shelf_life_months FROM items WHERE id = ?', [pkg.item_id]);
              if (item) months = item.shelf_life_months;
            }
            await conn.query('INSERT INTO sterile_stock SET ?', [{
              packaging_id: pkg.id,
              barcode: pkg.barcode,
              category: pkg.package_type,
              item_name: pkg.item_name,
              batch_no: steril.batch_no,
              sterile_date: steril.steril_date,
              expiry_date: addMonths(steril.steril_date, months),
              quantity: pkg.quantity,
              unit_label: pkg.unit_label,
              status: 'Tersedia',
            }]);
          }
          await conn.query("UPDATE packagings SET status = 'Lulus' WHERE id IN (?)", [packages.map((p) => p.id)]);
          await conn.query("UPDATE sterilizations SET status = 'Lulus' WHERE id = ?", [steril.id]);
          await conn.query("UPDATE dirty_receipts SET stage = 6, status = 'Selesai' WHERE id IN (?)", [receiptIds]);
        } else {
          await conn.query('DELETE FROM sterile_stock WHERE packaging_id IN (?)', [packages.map((p) => p.id)]);
          for (const pkg of packages) {
            await conn.query('INSERT INTO quarantines SET ?', [{
              packaging_id: pkg.id,
              verification_id: id,
              barcode: pkg.barcode,
              batch_no: steril.batch_no,
              reason: failReason,
              status: 'Karantina',
            }]);
          }
          await conn.query("UPDATE packagings SET status = 'Karantina' WHERE id IN (?)", [packages.map((p) => p.id)]);
          await conn.query("UPDATE sterilizations SET status = 'Gagal' WHERE id = ?", [steril.id]);
          await conn.query("UPDATE dirty_receipts SET stage = 6, status = 'Karantina' WHERE id IN (?)", [receiptIds]);
        }
      }
    }
  },
});

// ---------- Tahap 7: Stok Alat Steril (Lookup & Ready Stock for Distribution) ----------
router.get('/sterile-stock/lookup', auth, wrap(async (req, res) => {
  const code = (req.query.code || '').trim();
  if (!code) throw new HttpError(400, 'Parameter code wajib diisi');

  const [rows] = await pool.query(`
    SELECT t.*,
      ${STOCK_STATUS_SQL} AS display_status,
      DATEDIFF(t.expiry_date, CURDATE()) AS days_left,
      p.receipt_id,
      r.barcode AS receipt_barcode,
      r.unit_id AS origin_unit_id,
      u.name AS origin_unit_name,
      r.sender_name AS origin_sender,
      r.receipt_date,
      s.id AS set_id,
      s.code AS set_code,
      s.completeness_status,
      s.missing_notes
    FROM sterile_stock t
    LEFT JOIN packagings p ON p.id = t.packaging_id
    LEFT JOIN dirty_receipts r ON r.id = p.receipt_id
    LEFT JOIN units u ON u.id = r.unit_id
    LEFT JOIN instrument_sets s ON (s.name = t.item_name OR s.code = t.item_name)
    WHERE t.barcode = ? OR r.barcode = ?
    ORDER BY (t.status = 'Tersedia' AND t.quantity > 0) DESC, t.id DESC
    LIMIT 1
  `, [code, code]);

  if (!rows.length) {
    throw new HttpError(404, `Barcode "${code}" tidak ditemukan di stok steril`, { code: 'Barcode tidak ditemukan' });
  }

  const stock = rows[0];

  // Ambil rincian instrumen jika ini adalah set
  if (stock.set_id) {
    const [items] = await pool.query(
      'SELECT id, instrument_name, quantity, unit_label FROM instrument_set_items WHERE set_id = ? ORDER BY id ASC',
      [stock.set_id]
    );
    stock.items = items;
    stock.total_instruments = items.reduce((acc, c) => acc + Number(c.quantity || 1), 0);
  } else {
    stock.items = [];
    stock.total_instruments = 0;
  }

  res.json({ success: true, data: stock });
}));

router.get('/sterile-stock/ready', auth, wrap(async (req, res) => {
  const { unit_id, category, search, type } = req.query;
  let sql = `
    SELECT t.*,
      ${STOCK_STATUS_SQL} AS display_status,
      DATEDIFF(t.expiry_date, CURDATE()) AS days_left,
      p.receipt_id,
      r.barcode AS receipt_barcode,
      r.unit_id AS origin_unit_id,
      u.name AS origin_unit_name,
      r.sender_name AS origin_sender,
      r.receipt_date,
      s.id AS set_id,
      s.code AS set_code,
      s.completeness_status,
      s.missing_notes
    FROM sterile_stock t
    LEFT JOIN packagings p ON p.id = t.packaging_id
    LEFT JOIN dirty_receipts r ON r.id = p.receipt_id
    LEFT JOIN units u ON u.id = r.unit_id
    LEFT JOIN instrument_sets s ON (s.name = t.item_name OR s.code = t.item_name)
    WHERE t.status = 'Tersedia' AND t.quantity > 0 AND t.expiry_date >= CURDATE()
  `;
  const params = [];

  if (type === 'KASA') {
    sql += " AND t.category = 'Kasa Steril'";
  } else if (type === 'ALAT') {
    sql += " AND t.category != 'Kasa Steril'";
  }

  if (category) {
    sql += ' AND t.category = ?';
    params.push(category);
  }

  if (unit_id) {
    sql += ' AND (r.unit_id = ? OR r.unit_id IS NULL)';
    params.push(unit_id);
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    sql += ' AND (t.barcode LIKE ? OR t.item_name LIKE ? OR r.barcode LIKE ? OR u.name LIKE ? OR s.code LIKE ?)';
    params.push(q, q, q, q, q);
  }

  sql += ' ORDER BY t.id DESC LIMIT 50';

  const [rows] = await pool.query(sql, params);

  // Ambil rincian instrumen di dalam set jika ada
  for (const row of rows) {
    if (row.set_id) {
      const [items] = await pool.query(
        'SELECT id, instrument_name, quantity, unit_label FROM instrument_set_items WHERE set_id = ? ORDER BY id ASC',
        [row.set_id]
      );
      row.items = items;
      row.total_instruments = items.reduce((acc, c) => acc + Number(c.quantity || 1), 0);
    } else {
      row.items = [];
      row.total_instruments = 0;
    }
  }

  res.json({ success: true, data: rows });
}));

// ---------- Tahap 7: Stok Alat Steril (read-only, otomatis) ----------
registerCrud({
  path: 'sterile-stock',
  table: 'sterile_stock',
  readOnly: true,
  from: `sterile_stock t
    LEFT JOIN packagings p ON p.id = t.packaging_id
    LEFT JOIN dirty_receipts r ON r.id = p.receipt_id
    LEFT JOIN units u ON u.id = r.unit_id
    LEFT JOIN instrument_sets s ON (s.name = t.item_name OR s.code = t.item_name)`,
  select: `t.*,
    ${STOCK_STATUS_SQL} AS display_status,
    DATEDIFF(t.expiry_date, CURDATE()) AS days_left,
    p.receipt_id,
    r.barcode AS receipt_barcode,
    r.unit_id AS origin_unit_id,
    u.name AS origin_unit_name,
    r.sender_name AS origin_sender,
    r.receipt_date,
    s.id AS set_id,
    s.code AS set_code,
    s.completeness_status,
    (SELECT COALESCE(SUM(si.quantity), 0) FROM instrument_set_items si WHERE si.set_id = s.id) AS total_instruments,
    s.missing_notes`,
  search: ['t.barcode', 't.item_name', 't.batch_no', 'r.barcode', 'u.name', 's.code'],
  sort: { id: 't.id', barcode: 't.barcode', item_name: 't.item_name', category: 't.category', batch_no: 't.batch_no', sterile_date: 't.sterile_date', expiry_date: 't.expiry_date', quantity: 't.quantity' },
  defaultSort: 'id',
  filters: { category: 't.category', status: STOCK_STATUS_SQL, barcode: 't.barcode', batch_no: 't.batch_no', origin_unit_id: 'r.unit_id' },
  dateColumn: 't.sterile_date',
  exportColumns: [['item_name', 'Nama Alat'], ['category', 'Kategori'], ['barcode', 'Barcode'], ['batch_no', 'Batch'], ['sterile_date', 'Tgl Steril'], ['expiry_date', 'Tgl Kedaluwarsa'], ['quantity', 'Jumlah'], ['unit_label', 'Satuan'], ['display_status', 'Status']],
});

// ---------- Karantina / Gagal ----------
registerCrud({
  path: 'quarantines',
  table: 'quarantines',
  from: 'quarantines t',
  select: 't.*',
  search: ['t.barcode', 't.batch_no', 't.reason'],
  sort: { id: 't.id', barcode: 't.barcode', batch_no: 't.batch_no', status: 't.status', created_at: 't.created_at' },
  defaultSort: 'id',
  filters: { status: 't.status', barcode: 't.barcode' },
  dateColumn: 'DATE(t.created_at)',
  exportColumns: [['created_at', 'Waktu'], ['barcode', 'Barcode'], ['batch_no', 'Batch / Siklus'], ['reason', 'Alasan Gagal'], ['status', 'Status'], ['notes', 'Catatan']],
  noCreate: true,
  noDelete: true,
  fields: [
    field('status', 'enum', { values: ['Karantina', 'Diproses ulang', 'Dimusnahkan'], required: true, label: 'Status' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async afterUpdate(conn, id, data, ctx, existing) {
    if (data.status === 'Diproses ulang' && existing.status === 'Karantina') {
      // kemasan kembali ke tahap pengemasan agar bisa disterilkan ulang
      await conn.query("UPDATE packagings SET status = 'Dikemas' WHERE id = ?", [existing.packaging_id]);
      await conn.query(
        "UPDATE dirty_receipts SET stage = 4, status = 'Proses' WHERE id = (SELECT receipt_id FROM packagings WHERE id = ?)",
        [existing.packaging_id]
      );
    }
  },
});

// ---------- Tahap 8 & 9: Distribusi Alat / Kasa Steril (barcode) ----------
registerCrud({
  path: 'distributions',
  table: 'distributions',
  from: 'distributions t JOIN sterile_stock s ON s.id = t.stock_id JOIN units u ON u.id = t.unit_id',
  select: 't.*, s.item_name, s.category, s.batch_no, s.unit_label, u.name AS unit_name',
  search: ['t.barcode', 's.item_name', 't.gauze_type', 'u.name', 't.officer', 't.receiver_name'],
  sort: { id: 't.id', dist_date: 't.dist_date', barcode: 't.barcode', item_name: 's.item_name', unit_name: 'u.name', quantity: 't.quantity' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { type: 't.type', unit_id: 't.unit_id', gauze_type: 't.gauze_type', barcode: 't.barcode' },
  dateColumn: 't.dist_date',
  exportColumns: [['dist_date', 'Tanggal'], ['type', 'Jenis'], ['barcode', 'Barcode'], ['item_name', 'Nama'], ['gauze_type', 'Jenis Kasa'], ['batch_no', 'Batch'], ['unit_name', 'Unit Tujuan'], ['quantity', 'Jumlah'], ['officer', 'Petugas CSSD'], ['receiver_name', 'Penerima Unit']],
  roles: { read: ['admin', 'petugas', 'unit'], write: ['admin', 'petugas', 'unit'], remove: ['admin', 'petugas'] },
  fields: [
    field('type', 'enum', { values: ['ALAT', 'KASA'], required: true, label: 'Jenis distribusi' }),
    field('barcode', 'string', { required: true, label: 'Barcode', max: 50 }),
    field('unit_id', 'int', { required: true, min: 1, label: 'Unit tujuan' }),
    field('quantity', 'int', { required: true, min: 1, label: 'Jumlah' }),
    field('gauze_type', 'string', { label: 'Jenis Kasa', max: 100 }),
    field('officer', 'string', { required: true, label: 'Petugas CSSD', max: 100 }),
    field('officer_signature', 'path', { label: 'TTD Petugas CSSD' }),
    field('receiver_name', 'string', { label: 'Penerima di unit', max: 100 }),
    field('receiver_signature', 'path', { label: 'TTD Penerima (Unit)' }),
    field('dist_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeDelete(conn, existing) {
    // Kembalikan jumlah stok yang sudah didistribusikan ke sterile_stock
    await conn.query(
      "UPDATE sterile_stock SET quantity = quantity + ?, status = 'Tersedia' WHERE id = ?",
      [existing.quantity, existing.stock_id]
    );
    // Jika packaging berstatus 'Terdistribusi', kembalikan ke 'Lulus'
    const [[stk]] = await conn.query('SELECT packaging_id FROM sterile_stock WHERE id = ?', [existing.stock_id]);
    if (stk?.packaging_id) {
      await conn.query("UPDATE packagings SET status = 'Lulus' WHERE id = ?", [stk.packaging_id]);
    }
  },
  async beforeUpdate(conn, data, ctx, existing) {
    if (data.quantity !== undefined && data.quantity !== existing.quantity) {
      const diff = data.quantity - existing.quantity;
      if (diff > 0) {
        const [[stk]] = await conn.query('SELECT quantity FROM sterile_stock WHERE id = ?', [existing.stock_id]);
        if (!stk || stk.quantity < diff) {
          throw new HttpError(422, `Sisa stok tidak mencukupi untuk menambah jumlah (${stk?.quantity || 0} tersedia)`);
        }
      }
      await conn.query(
        "UPDATE sterile_stock SET quantity = quantity - ?, status = IF(quantity <= 0, 'Terdistribusi', 'Tersedia') WHERE id = ?",
        [diff, existing.stock_id]
      );
    }
  },
  async beforeCreate(conn, data, ctx) {
    if (ctx.user.role === 'unit' && ctx.user.unit_id) {
      data.unit_id = ctx.user.unit_id;
    }
    const [[stock]] = await conn.query(`
      SELECT s.*, p.receipt_id, r.barcode AS receipt_barcode, r.unit_id AS origin_unit_id, u.name AS origin_unit_name
      FROM sterile_stock s
      LEFT JOIN packagings p ON p.id = s.packaging_id
      LEFT JOIN dirty_receipts r ON r.id = p.receipt_id
      LEFT JOIN units u ON u.id = r.unit_id
      WHERE (s.barcode = ? OR r.barcode = ?)
      ORDER BY (s.status = 'Tersedia' AND s.quantity > 0) DESC, s.id DESC
      LIMIT 1
      FOR UPDATE
    `, [data.barcode, data.barcode]);

    if (!stock) throw new HttpError(404, 'Barcode tidak ditemukan di stok steril', { barcode: 'Barcode tidak ditemukan di stok steril' });
    if (stock.status !== 'Tersedia' || stock.quantity < 1) throw new HttpError(409, 'Stok untuk barcode ini sudah habis', { barcode: 'Stok sudah habis' });
    if (stock.expiry_date < todayStr()) throw new HttpError(409, 'Alat sudah kedaluwarsa dan tidak boleh didistribusikan', { barcode: 'Alat kedaluwarsa' });
    const isGauze = stock.category === 'Kasa Steril';
    if (data.type === 'KASA' && !isGauze) throw new HttpError(422, 'Barcode ini bukan kasa steril, gunakan menu Distribusi Alat Steril', { barcode: 'Bukan kasa steril' });
    if (data.type === 'ALAT' && isGauze) throw new HttpError(422, 'Barcode ini adalah kasa steril, gunakan menu Distribusi Kasa Steril', { barcode: 'Ini kasa steril' });
    if (data.quantity > stock.quantity) throw new HttpError(422, `Jumlah melebihi stok tersedia (${stock.quantity})`, { quantity: `Maksimal ${stock.quantity}` });

    // Gunakan barcode resmi paket steril dan isi otomatis unit tujuan jika belum diisi
    data.barcode = stock.barcode;
    if (!data.unit_id && stock.origin_unit_id) {
      data.unit_id = stock.origin_unit_id;
    }
    data.stock_id = stock.id;
    ctx.stock = stock;
  },
  async afterCreate(conn, id, data, ctx) {
    await conn.query(
      "UPDATE sterile_stock SET quantity = quantity - ?, status = IF(quantity <= 0, 'Terdistribusi', status) WHERE id = ?",
      [data.quantity, ctx.stock.id]
    );
    if (ctx.stock.quantity - data.quantity <= 0) {
      await conn.query("UPDATE packagings SET status = 'Terdistribusi' WHERE id = ?", [ctx.stock.packaging_id]);
    }
  },
});

// ---------- DTT (RIUS) Transaksi 1: Penerimaan Alat Kotor DTT/RIUS (Unit -> CSSD) ----------
registerCrud({
  path: 'dtt-receipts',
  table: 'dtt_receipts',
  from: 'dtt_receipts t JOIN units u ON u.id = t.unit_id',
  select: 't.*, u.name AS unit_name, u.code AS unit_code',
  search: ['t.barcode', 't.item_name', 't.item_code', 'u.name', 't.sender_name', 't.receiver_name'],
  sort: { id: 't.id', barcode: 't.barcode', receipt_datetime: 't.receipt_datetime', item_name: 't.item_name', unit_name: 'u.name', reuse_count: 't.reuse_count', tool_condition: 't.tool_condition', process_stage: 't.process_stage' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { unit_id: 't.unit_id', tool_condition: 't.tool_condition', process_stage: 't.process_stage', verification_result: 't.verification_result', barcode: 't.barcode' },
  dateColumn: 'DATE(t.receipt_datetime)',
  exportColumns: [
    ['barcode', 'Barcode DTT'],
    ['receipt_datetime', 'Waktu Penerimaan'],
    ['unit_name', 'Unit Pengirim'],
    ['item_code', 'Kode Alat'],
    ['item_name', 'Nama Alat Medis'],
    ['quantity', 'Jumlah'],
    ['unit_label', 'Satuan'],
    ['reuse_count', 'Penggunaan Ke-'],
    ['max_reuse_limit', 'Batas Maks Reuse'],
    ['tool_condition', 'Kondisi Alat'],
    ['sender_name', 'Penyerah Unit'],
    ['receiver_name', 'Penerima CSSD'],
    ['process_stage', 'Tahap Proses'],
    ['verification_result', 'Hasil Verifikasi'],
  ],
  roles: { read: ['admin', 'petugas', 'unit'], write: ['admin', 'petugas', 'unit'], remove: ['admin', 'petugas'] },
  fields: [
    field('barcode', 'string', { label: 'Barcode', max: 50, createOnly: true }),
    field('receipt_datetime', 'datetime', { default: () => new Date().toISOString().slice(0, 19).replace('T', ' '), label: 'Waktu Penerimaan' }),
    field('unit_id', 'int', { required: true, min: 1, label: 'Unit pengirim' }),
    field('item_code', 'string', { label: 'Kode alat', max: 50 }),
    field('item_name', 'string', { required: true, label: 'Nama alat DTT / RIUS', max: 150 }),
    field('quantity', 'int', { required: true, min: 1, label: 'Jumlah' }),
    field('unit_label', 'string', { default: 'pcs', max: 30, label: 'Satuan' }),
    field('reuse_count', 'int', { required: true, min: 1, default: 1, label: 'Penggunaan Ke-' }),
    field('max_reuse_limit', 'int', { min: 1, default: 10, label: 'Batas Pemakaian Ulang' }),
    field('tool_condition', 'enum', { values: ['Baik', 'Perlu Perbaikan', 'Rusak / Afkir'], default: 'Baik', label: 'Kondisi Alat' }),
    field('sender_name', 'string', { required: true, label: 'Petugas penyerah (unit)', max: 100 }),
    field('sender_signature', 'path', { label: 'TTD penyerah' }),
    field('receiver_name', 'string', { required: true, label: 'Petugas penerima (CSSD)', max: 100 }),
    field('receiver_signature', 'path', { label: 'TTD penerima' }),
    field('process_stage', 'enum', { values: ['Diterima', 'Pencucian DTT', 'Penyimpanan DTT', 'Siap Distribusi', 'Selesai'], default: 'Diterima', label: 'Tahap Proses' }),
    field('dtt_method', 'string', { default: 'DTT Manual (Perendaman Enzimatik & Disinfektan)', max: 100, label: 'Metode DTT' }),
    field('dtt_liquid', 'string', { default: 'Glutaraldehyde 2%', max: 100, label: 'Cairan DTT' }),
    field('dtt_duration_min', 'int', { default: 20, min: 1, max: 300, label: 'Waktu DTT (menit)' }),
    field('verification_result', 'enum', { values: ['Belum Diverifikasi', 'Lolos', 'Gagal / Cuci Ulang'], default: 'Belum Diverifikasi', label: 'Hasil Verifikasi' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    if (ctx.user.role === 'unit' && ctx.user.unit_id) {
      data.unit_id = ctx.user.unit_id;
    }
    const today = (data.receipt_datetime || todayStr()).slice(0, 10);
    data.barcode = data.barcode || (await makeCode(conn, 'RD', today));
  },
});

// ---------- DTT (RIUS) Transaksi 2: Distribusi Alat Hasil DTT (CSSD -> Unit) ----------
registerCrud({
  path: 'dtt-distributions',
  table: 'dtt_distributions',
  from: 'dtt_distributions t JOIN units u ON u.id = t.unit_id JOIN dtt_receipts r ON r.id = t.dtt_receipt_id',
  select: 't.*, u.name AS unit_name, r.barcode AS receipt_barcode',
  search: ['t.barcode', 't.item_name', 'u.name', 't.officer', 't.receiver_name', 'r.barcode'],
  sort: { id: 't.id', dist_datetime: 't.dist_datetime', barcode: 't.barcode', item_name: 't.item_name', unit_name: 'u.name' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { unit_id: 't.unit_id', tool_condition: 't.tool_condition', barcode: 't.barcode' },
  dateColumn: 'DATE(t.dist_datetime)',
  exportColumns: [
    ['barcode', 'Barcode Distribusi'],
    ['dist_datetime', 'Waktu Distribusi'],
    ['receipt_barcode', 'Barcode Penerimaan'],
    ['item_name', 'Nama Alat'],
    ['quantity', 'Jumlah'],
    ['unit_label', 'Satuan'],
    ['unit_name', 'Unit Penerima'],
    ['reuse_count', 'Penggunaan Ke-'],
    ['tool_condition', 'Kondisi'],
    ['officer', 'Petugas CSSD'],
    ['receiver_name', 'Penerima Unit'],
  ],
  roles: { read: ['admin', 'petugas', 'unit'], write: ['admin', 'petugas', 'unit'], remove: ['admin', 'petugas'] },
  fields: [
    field('barcode', 'string', { label: 'Barcode', max: 50, createOnly: true }),
    field('dtt_receipt_id', 'int', { required: true, min: 1, label: 'Alat DTT' }),
    field('dist_datetime', 'datetime', { default: () => new Date().toISOString().slice(0, 19).replace('T', ' '), label: 'Waktu Distribusi' }),
    field('unit_id', 'int', { required: true, min: 1, label: 'Unit penerima' }),
    field('item_name', 'string', { required: true, label: 'Nama alat', max: 150 }),
    field('quantity', 'int', { required: true, min: 1, label: 'Jumlah' }),
    field('unit_label', 'string', { default: 'pcs', max: 30, label: 'Satuan' }),
    field('reuse_count', 'int', { min: 1, default: 1, label: 'Penggunaan Ke-' }),
    field('tool_condition', 'enum', { values: ['Baik', 'Perlu Perbaikan', 'Rusak / Afkir'], default: 'Baik', label: 'Kondisi Alat' }),
    field('officer', 'string', { required: true, label: 'Petugas penyerah (CSSD)', max: 100 }),
    field('officer_signature', 'path', { label: 'TTD Petugas CSSD' }),
    field('receiver_name', 'string', { required: true, label: 'Petugas penerima (Unit)', max: 100 }),
    field('receiver_signature', 'path', { label: 'TTD Petugas Unit' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    if (ctx.user.role === 'unit' && ctx.user.unit_id) {
      data.unit_id = ctx.user.unit_id;
    }
    const today = (data.dist_datetime || todayStr()).slice(0, 10);
    data.barcode = data.barcode || (await makeCode(conn, 'DDTT', today));
    await conn.query("UPDATE dtt_receipts SET process_stage = 'Selesai' WHERE id = ?", [data.dtt_receipt_id]);
  },
  async beforeDelete(conn, existing) {
    await conn.query("UPDATE dtt_receipts SET process_stage = 'Siap Distribusi' WHERE id = ?", [existing.dtt_receipt_id]);
  },
});

router.get('/dtt-receipts/ready', auth, wrap(async (req, res) => {
  let where = "WHERE t.process_stage IN ('Siap Distribusi', 'Penyimpanan DTT', 'Pencucian DTT', 'Diterima')";
  const params = [];
  if (req.user.role === 'unit' && req.user.unit_id) {
    where += " AND t.unit_id = ?";
    params.push(req.user.unit_id);
  }
  const [rows] = await pool.query(`
    SELECT t.*, u.name AS unit_name 
    FROM dtt_receipts t 
    JOIN units u ON u.id = t.unit_id 
    ${where} 
    ORDER BY t.id DESC LIMIT 100
  `, params);
  res.json({ success: true, data: rows });
}));

// ---------- BMHP ----------
registerCrud({
  path: 'bmhp-items',
  table: 'bmhp_items',
  from: 'bmhp_items t',
  select: `t.*,
    COALESCE((SELECT SUM(quantity) FROM bmhp_transactions WHERE bmhp_item_id = t.id AND type = 'MASUK'), 0) AS total_in,
    COALESCE((SELECT SUM(quantity) FROM bmhp_transactions WHERE bmhp_item_id = t.id AND type = 'KELUAR'), 0) AS total_out,
    (t.stock <= 0) AS is_empty,
    (t.stock > 0 AND t.stock <= t.min_stock) AS is_low,
    DATEDIFF(t.expiry_date, CURDATE()) AS days_left,
    (CASE
      WHEN t.expiry_date IS NULL THEN 'Tidak Ada Exp'
      WHEN t.expiry_date < CURDATE() THEN 'Kedaluwarsa'
      WHEN DATEDIFF(t.expiry_date, CURDATE()) <= 30 THEN 'Mendekati Expired'
      ELSE 'Aman'
    END) AS expiry_status`,
  search: ['t.code', 't.barcode', 't.name', 't.category', 't.item_type', 't.specification', 't.batch_no'],
  sort: { id: 't.id', code: 't.code', name: 't.name', category: 't.category', stock: 't.stock', min_stock: 't.min_stock', expiry_date: 't.expiry_date' },
  defaultSort: 'id',
  filters: {
    is_active: 't.is_active',
    category: 't.category',
    barcode: 't.barcode',
    is_low: '(t.stock <= t.min_stock)',
    stock_status: (val) => {
      if (val === 'empty') return 't.stock <= 0';
      if (val === 'low') return 't.stock > 0 AND t.stock <= t.min_stock';
      if (val === 'safe') return 't.stock > t.min_stock';
      return null;
    },
    expiry_status: (val) => {
      if (val === 'expired') return 't.expiry_date IS NOT NULL AND t.expiry_date < CURDATE()';
      if (val === 'expiring') return 't.expiry_date IS NOT NULL AND t.expiry_date >= CURDATE() AND t.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)';
      if (val === 'safe') return 't.expiry_date IS NULL OR t.expiry_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY)';
      return null;
    },
  },
  exportColumns: [
    ['code', 'Kode'],
    ['barcode', 'Barcode'],
    ['name', 'Nama BMHP'],
    ['category', 'Kategori'],
    ['item_type', 'Jenis'],
    ['specification', 'Spesifikasi'],
    ['package_volume', 'Volume Kemasan'],
    ['unit_label', 'Satuan'],
    ['initial_stock', 'Stok Awal'],
    ['total_in', 'Masuk'],
    ['total_out', 'Keluar'],
    ['stock', 'Stok Akhir'],
    ['min_stock', 'Stok Minimum'],
    ['batch_no', 'No. Batch'],
    ['expiry_date', 'Tanggal Expired'],
    ['expiry_status', 'Status Expired'],
  ],
  roles: { write: ['admin', 'petugas'], remove: ['admin', 'petugas'] },
  fields: [
    field('code', 'string', { required: true, label: 'Kode', max: 30 }),
    field('barcode', 'string', { label: 'Barcode', max: 50 }),
    field('name', 'string', { required: true, label: 'Nama BMHP', max: 150 }),
    field('category', 'string', { label: 'Kategori', max: 100 }),
    field('item_type', 'string', { label: 'Jenis', max: 100 }),
    field('specification', 'string', { label: 'Spesifikasi', max: 255 }),
    field('package_volume', 'string', { label: 'Volume kemasan', max: 100 }),
    field('unit_label', 'string', { default: 'pcs', max: 30, label: 'Satuan' }),
    field('initial_stock', 'int', { min: 0, default: 0, label: 'Stok awal' }),
    field('stock', 'int', { default: 0, label: 'Stok akhir' }),
    field('min_stock', 'int', { min: 0, default: 0, label: 'Stok minimum' }),
    field('batch_no', 'string', { label: 'No. batch', max: 50 }),
    field('expiry_date', 'date', { label: 'Tanggal expired' }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
  async beforeCreate(conn, data) {
    if (data.initial_stock !== undefined && (data.stock === undefined || data.stock === 0)) {
      data.stock = data.initial_stock;
    }
  },
  async beforeUpdate(conn, id, data, existing) {
    if (data.initial_stock !== undefined && Number(data.initial_stock) !== Number(existing.initial_stock)) {
      const [[mut]] = await conn.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'MASUK' THEN quantity ELSE 0 END), 0) AS total_in,
          COALESCE(SUM(CASE WHEN type = 'KELUAR' THEN quantity ELSE 0 END), 0) AS total_out
        FROM bmhp_transactions WHERE bmhp_item_id = ?
      `, [id]);
      data.stock = Number(data.initial_stock) + Number(mut.total_in) - Number(mut.total_out);
    }
  },
  async beforeDelete(conn, existing) {
    if (existing.stock > 0) throw new HttpError(409, 'BMHP masih memiliki stok dan tidak dapat dihapus');
  },
});

registerCrud({
  path: 'bmhp-transactions',
  table: 'bmhp_transactions',
  from: 'bmhp_transactions t JOIN bmhp_items b ON b.id = t.bmhp_item_id LEFT JOIN units u ON u.id = t.unit_id',
  select: 't.*, b.name AS item_name, b.code AS item_code, b.unit_label, b.category, u.name AS unit_name',
  search: ['b.name', 'b.code', 'b.barcode', 't.batch_no', 't.officer', 'b.category'],
  sort: { id: 't.id', trx_date: 't.trx_date', item_name: 'b.name', type: 't.type', quantity: 't.quantity' },
  defaultSort: 'id',
  filters: { type: 't.type', bmhp_item_id: 't.bmhp_item_id', unit_id: 't.unit_id' },
  dateColumn: 't.trx_date',
  exportColumns: [['trx_date', 'Tanggal'], ['type', 'Jenis'], ['item_code', 'Kode'], ['item_name', 'Nama BMHP'], ['quantity', 'Jumlah'], ['unit_label', 'Satuan'], ['batch_no', 'Batch'], ['expiry_date', 'Tanggal Expired'], ['unit_name', 'Unit Pemakai'], ['stock_after', 'Stok Akhir'], ['officer', 'Petugas']],
  noUpdate: true,
  noDelete: true,
  fields: [
    field('bmhp_item_id', 'int', { required: true, min: 1, label: 'BMHP' }),
    field('type', 'enum', { values: ['MASUK', 'KELUAR'], required: true, label: 'Jenis transaksi' }),
    field('quantity', 'int', { required: true, min: 1, label: 'Jumlah' }),
    field('batch_no', 'string', { label: 'Batch', max: 50 }),
    field('expiry_date', 'date', { label: 'Tanggal expired' }),
    field('unit_id', 'int', { min: 1, label: 'Unit pemakai' }),
    field('officer', 'string', { required: true, label: 'Petugas', max: 100 }),
    field('trx_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data) {
    const [[item]] = await conn.query('SELECT * FROM bmhp_items WHERE id = ? AND is_active = 1 FOR UPDATE', [data.bmhp_item_id]);
    if (!item) throw new HttpError(404, 'BMHP tidak ditemukan atau tidak aktif', { bmhp_item_id: 'BMHP tidak valid' });
    const after = data.type === 'MASUK' ? item.stock + data.quantity : item.stock - data.quantity;
    if (after < 0) throw new HttpError(422, `Stok tidak cukup (tersedia ${item.stock} ${item.unit_label})`, { quantity: `Stok tersedia ${item.stock}` });
    data.stock_after = after;
  },
  async afterCreate(conn, id, data) {
    await conn.query('UPDATE bmhp_items SET stock = ? WHERE id = ?', [data.stock_after, data.bmhp_item_id]);
    if (data.type === 'MASUK') {
      const updates = [];
      const params = [];
      if (data.batch_no) {
        updates.push('batch_no = ?');
        params.push(data.batch_no);
      }
      if (data.expiry_date) {
        updates.push('expiry_date = ?');
        params.push(data.expiry_date);
      }
      if (updates.length) {
        params.push(data.bmhp_item_id);
        await conn.query(`UPDATE bmhp_items SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    }
  },
});

/* ============================================================
 * SET INSTRUMEN (MONITORING STOK & RINCIAN INSTRUMEN)
 * ============================================================ */
async function getInstrumentSetsWithStock(query = {}) {
  let sql = 'SELECT * FROM instrument_sets WHERE 1=1';
  const params = [];
  if (query.is_active !== undefined) {
    sql += ' AND is_active = ?';
    params.push(Number(query.is_active));
  }
  if (query.completeness_status) {
    sql += ' AND completeness_status = ?';
    params.push(query.completeness_status);
  }
  if (query.search) {
    const like = `%${query.search.trim()}%`;
    sql += ' AND (name LIKE ? OR code LIKE ?)';
    params.push(like, like);
  }
  sql += ' ORDER BY id ASC';

  const [sets] = await pool.query(sql, params);
  if (!sets.length) return [];

  const setIds = sets.map((s) => s.id);
  const [items] = await pool.query(
    'SELECT * FROM instrument_set_items WHERE set_id IN (?) ORDER BY sort_order ASC, id ASC',
    [setIds]
  );

  const itemsBySet = {};
  for (const it of items) {
    if (!itemsBySet[it.set_id]) itemsBySet[it.set_id] = [];
    itemsBySet[it.set_id].push(it);
  }

  // Hitung stok siap pakai (Tersedia) dari sterile_stock
  const [stockRows] = await pool.query(`
    SELECT 
      LOWER(TRIM(item_name)) AS norm_name,
      SUM(CASE WHEN status = 'Tersedia' AND expiry_date >= CURDATE() THEN quantity ELSE 0 END) AS available_qty
    FROM sterile_stock
    GROUP BY LOWER(TRIM(item_name))
  `);
  const stockMap = {};
  for (const row of stockRows) {
    stockMap[row.norm_name] = Number(row.available_qty) || 0;
  }

  // Hitung alat kotor yang sedang diproses (Diterima / Proses)
  const [processRows] = await pool.query(`
    SELECT LOWER(TRIM(item_name)) AS norm_name, SUM(quantity) AS in_process_qty
    FROM dirty_receipts
    WHERE status IN ('Diterima', 'Proses')
    GROUP BY LOWER(TRIM(item_name))
  `);
  const processMap = {};
  for (const row of processRows) {
    processMap[row.norm_name] = Number(row.in_process_qty) || 0;
  }

  // Hitung alat yang sedang terdistribusi di unit
  const [distRows] = await pool.query(`
    SELECT LOWER(TRIM(s.item_name)) AS norm_name, SUM(t.quantity) AS distributed_qty
    FROM distributions t
    JOIN sterile_stock s ON s.id = t.stock_id
    GROUP BY LOWER(TRIM(s.item_name))
  `);
  const distMap = {};
  for (const row of distRows) {
    distMap[row.norm_name] = Number(row.distributed_qty) || 0;
  }

  // Hitung alat kotor yang sudah dikembalikan oleh unit
  const [returnRows] = await pool.query(`
    SELECT LOWER(TRIM(item_name)) AS norm_name, SUM(quantity) AS returned_qty
    FROM dirty_receipts
    GROUP BY LOWER(TRIM(item_name))
  `);
  const returnMap = {};
  for (const row of returnRows) {
    returnMap[row.norm_name] = Number(row.returned_qty) || 0;
  }

  // Riwayat insiden / discrepancy instrumen yang belum selesai
  const [discRows] = await pool.query(`
    SELECT * FROM instrument_discrepancy_logs 
    WHERE resolution_status = 'Belum Selesai' 
    ORDER BY incident_date DESC
  `).catch(() => [[]]);
  const discBySet = {};
  for (const d of (discRows || [])) {
    if (!discBySet[d.set_id]) discBySet[d.set_id] = [];
    discBySet[d.set_id].push(d);
  }

  return sets.map((set) => {
    const setItems = itemsBySet[set.id] || [];
    const totalInstruments = setItems.reduce((acc, cur) => acc + (Number(cur.quantity) || 0), 0);
    const normName = set.name.toLowerCase().trim();

    let avail = stockMap[normName] ?? 0;
    let inProcess = processMap[normName] ?? 0;
    let dist = distMap[normName] ?? 0;
    let returned = returnMap[normName] ?? 0;

    // Fuzzy matching jika nama agak berbeda (misal: "Set Laparotomi" vs "SET LAPAROTOMI")
    if (avail === 0) {
      for (const [k, v] of Object.entries(stockMap)) {
        if (k.includes(normName) || normName.includes(k)) {
          avail = v;
          break;
        }
      }
    }
    if (inProcess === 0) {
      for (const [k, v] of Object.entries(processMap)) {
        if (k.includes(normName) || normName.includes(k)) {
          inProcess = v;
          break;
        }
      }
    }
    if (dist === 0) {
      for (const [k, v] of Object.entries(distMap)) {
        if (k.includes(normName) || normName.includes(k)) {
          dist = v;
          break;
        }
      }
    }
    if (returned === 0) {
      for (const [k, v] of Object.entries(returnMap)) {
        if (k.includes(normName) || normName.includes(k)) {
          returned = v;
          break;
        }
      }
    }

    const inUnit = Math.max(0, dist - returned);
    const activeDiscrepancies = discBySet[set.id] || [];

    return {
      ...set,
      items: setItems,
      total_instruments: totalInstruments,
      available_stock: avail,
      in_process_stock: inProcess,
      distributed_stock: dist,
      in_unit_stock: inUnit,
      is_available: avail > 0,
      discrepancy_count: activeDiscrepancies.length,
      active_discrepancies: activeDiscrepancies,
    };
  });
}

router.get('/instrument-sets', auth, wrap(async (req, res) => {
  const sets = await getInstrumentSetsWithStock(req.query);
  res.json({ success: true, data: sets });
}));

// GET /instrument-sets/movements (Monitoring mutasi & pergerakan pengambilan & pengembalian)
router.get('/instrument-sets/movements', auth, wrap(async (req, res) => {
  const query = req.query || {};
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = ALLOWED_LIMITS.includes(Number(query.limit)) ? Number(query.limit) : DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const typeFilter = query.type || null;

  // 1. Pengambilan oleh Unit (Distribusi -> stok berkurang)
  const [distRows] = await pool.query(`
    SELECT 
      'PENGAMBILAN' AS movement_type,
      d.id,
      d.dist_date AS trx_date,
      d.created_at,
      d.quantity,
      d.officer,
      d.receiver_name,
      u.name AS unit_name,
      s.item_name AS set_name,
      s.barcode,
      s.batch_no,
      d.notes,
      'Unit Mengambil Set Steril (Stok Berkurang)' AS description
    FROM distributions d
    JOIN sterile_stock s ON s.id = d.stock_id
    JOIN units u ON u.id = d.unit_id
    WHERE (s.category = 'Set Instrumen' OR s.item_name LIKE '%SET%' OR s.unit_label = 'set')
  `);

  // 2. Pengembalian Set Kotor oleh Unit (Alat kotor -> masuk antrean sterilisasi)
  const [receiptRows] = await pool.query(`
    SELECT 
      'PENGEMBALIAN' AS movement_type,
      dr.id,
      dr.receipt_date AS trx_date,
      dr.created_at,
      dr.quantity,
      dr.receiver_name AS officer,
      dr.sender_name AS receiver_name,
      u.name AS unit_name,
      dr.item_name AS set_name,
      dr.barcode,
      '-' AS batch_no,
      CONCAT('Status: ', dr.status, ' (Tahap ', dr.stage, ')') AS notes,
      'Unit Mengembalikan Set Kotor (Masuk Sterilisasi)' AS description
    FROM dirty_receipts dr
    JOIN units u ON u.id = dr.unit_id
    WHERE (dr.item_name LIKE '%SET%' OR dr.item_name LIKE '%Set%' OR EXISTS (SELECT 1 FROM instrument_sets iset WHERE LOWER(iset.name) = LOWER(dr.item_name)))
  `);

  let allMovements = [...distRows, ...receiptRows];

  if (typeFilter && typeFilter !== 'ALL') {
    allMovements = allMovements.filter((m) => m.movement_type === typeFilter);
  }

  if (query.search) {
    const q = query.search.trim().toLowerCase();
    allMovements = allMovements.filter((m) =>
      (m.set_name && m.set_name.toLowerCase().includes(q)) ||
      (m.unit_name && m.unit_name.toLowerCase().includes(q)) ||
      (m.barcode && m.barcode.toLowerCase().includes(q)) ||
      (m.officer && m.officer.toLowerCase().includes(q))
    );
  }

  allMovements.sort((a, b) => new Date(b.created_at || b.trx_date) - new Date(a.created_at || a.trx_date));

  const total = allMovements.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = allMovements.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginated,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}));

// GET /instrument-sets/discrepancies (Riwayat instrumen hilang, rusak, atau kurang)
router.get('/instrument-sets/discrepancies', auth, wrap(async (req, res) => {
  const query = req.query || {};
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = ALLOWED_LIMITS.includes(Number(query.limit)) ? Number(query.limit) : DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  let params = [];

  if (query.set_id) {
    where.push('d.set_id = ?');
    params.push(parseId(query.set_id));
  }
  if (query.resolution_status && query.resolution_status !== 'ALL') {
    where.push('d.resolution_status = ?');
    params.push(query.resolution_status);
  }
  if (query.incident_type && query.incident_type !== 'ALL') {
    where.push('d.incident_type = ?');
    params.push(query.incident_type);
  }
  if (query.search) {
    const like = `%${query.search.trim()}%`;
    where.push('(d.instrument_name LIKE ? OR s.name LIKE ? OR d.notes LIKE ? OR d.officer LIKE ? OR d.unit_origin LIKE ?)');
    params.push(like, like, like, like, like);
  }

  const whereSql = where.join(' AND ');

  const [[{ total }]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM instrument_discrepancy_logs d
    JOIN instrument_sets s ON s.id = d.set_id
    WHERE ${whereSql}
  `, params);

  const [rows] = await pool.query(`
    SELECT 
      d.*,
      s.name AS set_name,
      s.code AS set_code
    FROM instrument_discrepancy_logs d
    JOIN instrument_sets s ON s.id = d.set_id
    WHERE ${whereSql}
    ORDER BY d.resolution_status ASC, d.incident_date DESC, d.id DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  res.json({
    success: true,
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}));

// POST /instrument-sets/discrepancies (Catat instrumen hilang, rusak, atau kurang)
router.post('/instrument-sets/discrepancies', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const body = req.body || {};
  const setId = parseId(body.set_id);
  if (!body.instrument_name || !body.instrument_name.trim()) {
    throw new HttpError(422, 'Nama instrumen wajib diisi');
  }
  const incidentType = ['Kurang', 'Hilang', 'Rusak', 'Ditemukan Kembali', 'Diganti Baru'].includes(body.incident_type)
    ? body.incident_type
    : 'Kurang';
  const qty = Math.max(parseInt(body.quantity, 10) || 1, 1);
  const incidentDate = body.incident_date || todayStr();
  const officer = (body.officer && body.officer.trim()) || req.user.name || 'Petugas CSSD';
  const unitOrigin = body.unit_origin ? String(body.unit_origin).trim() : null;
  const notes = body.notes ? String(body.notes).trim() : null;

  const id = await withTx(async (conn) => {
    const [[set]] = await conn.query('SELECT * FROM instrument_sets WHERE id = ? FOR UPDATE', [setId]);
    if (!set) throw new HttpError(404, 'Set instrumen tidak ditemukan');

    const [ins] = await conn.query('INSERT INTO instrument_discrepancy_logs SET ?', [{
      set_id: setId,
      instrument_name: body.instrument_name.trim(),
      incident_type: incidentType,
      quantity: qty,
      unit_origin: unitOrigin,
      officer,
      incident_date: incidentDate,
      notes,
      resolution_status: 'Belum Selesai',
    }]);

    // Jika insiden kurang/hilang/rusak, otomatis perbarui status set menjadi 'Tidak Lengkap'
    if (['Kurang', 'Hilang', 'Rusak'].includes(incidentType)) {
      const detailNote = `${body.instrument_name.trim()} (${incidentType.toLowerCase()} ${qty} pcs${notes ? ': ' + notes : ''})`;
      let updatedNotes = set.missing_notes ? `${set.missing_notes}; ${detailNote}` : detailNote;
      if (updatedNotes.length > 255) updatedNotes = updatedNotes.slice(0, 252) + '...';

      await conn.query(`
        UPDATE instrument_sets 
        SET completeness_status = 'Tidak Lengkap', missing_notes = ?
        WHERE id = ?
      `, [updatedNotes, setId]);
    }

    return ins.insertId;
  });

  const [[created]] = await pool.query(`
    SELECT d.*, s.name AS set_name, s.code AS set_code
    FROM instrument_discrepancy_logs d
    JOIN instrument_sets s ON s.id = d.set_id
    WHERE d.id = ?
  `, [id]);

  res.status(201).json({
    success: true,
    message: 'Riwayat instrumen berhasil dicatat',
    data: created,
  });
}));

// PATCH /instrument-sets/discrepancies/:id/resolve (Tandai selesai / diganti baru / ditemukan)
router.patch('/instrument-sets/discrepancies/:id/resolve', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const body = req.body || {};
  const resolutionNotes = body.resolution_notes ? String(body.resolution_notes).trim() : 'Sudah diselesaikan / diganti';

  await withTx(async (conn) => {
    const [[existing]] = await conn.query('SELECT * FROM instrument_discrepancy_logs WHERE id = ? FOR UPDATE', [id]);
    if (!existing) throw new HttpError(404, 'Riwayat instrumen tidak ditemukan');

    await conn.query(`
      UPDATE instrument_discrepancy_logs
      SET resolution_status = 'Selesai', resolution_notes = ?, resolved_at = NOW()
      WHERE id = ?
    `, [resolutionNotes, id]);

    // Cek apakah masih ada insiden belum selesai untuk set ini
    const [[{ remaining }]] = await conn.query(`
      SELECT COUNT(*) AS remaining
      FROM instrument_discrepancy_logs
      WHERE set_id = ? AND resolution_status = 'Belum Selesai'
    `, [existing.set_id]);

    if (remaining === 0) {
      await conn.query(`
        UPDATE instrument_sets
        SET completeness_status = 'Lengkap', missing_notes = NULL
        WHERE id = ?
      `, [existing.set_id]);
    }
  });

  const [[updated]] = await pool.query(`
    SELECT d.*, s.name AS set_name, s.code AS set_code
    FROM instrument_discrepancy_logs d
    JOIN instrument_sets s ON s.id = d.set_id
    WHERE d.id = ?
  `, [id]);

  res.json({
    success: true,
    message: 'Insiden instrumen berhasil diselesaikan',
    data: updated,
  });
}));

// DELETE /instrument-sets/discrepancies/:id
router.delete('/instrument-sets/discrepancies/:id', auth, allow('admin'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const [[existing]] = await pool.query('SELECT * FROM instrument_discrepancy_logs WHERE id = ?', [id]);
  if (!existing) throw new HttpError(404, 'Riwayat instrumen tidak ditemukan');

  await pool.query('DELETE FROM instrument_discrepancy_logs WHERE id = ?', [id]);
  res.json({ success: true, message: 'Riwayat instrumen berhasil dihapus' });
}));

router.get('/instrument-sets/:id', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const sets = await getInstrumentSetsWithStock();
  const set = sets.find((s) => s.id === id);
  if (!set) throw new HttpError(404, 'Set instrumen tidak ditemukan');
  res.json({ success: true, data: set });
}));

router.post('/instrument-sets', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.name.trim()) throw new HttpError(422, 'Nama set instrumen wajib diisi');
  const completeness = body.completeness_status === 'Tidak Lengkap' ? 'Tidak Lengkap' : 'Lengkap';
  const missingNotes = body.missing_notes ? String(body.missing_notes).trim() : null;
  const description = body.description ? String(body.description).trim() : null;
  const items = Array.isArray(body.items) ? body.items : [];
  const normalizedName = body.name.trim().toUpperCase();

  const id = await withTx(async (conn) => {
    // 1. Tentukan Kode Set yang dijamin unik & tidak pernah duplikat / 409
    let code = (body.code && body.code.trim().toUpperCase()) || '';
    if (!code) {
      // Cari nomor urut SET berikutnya dari instrument_sets dan items
      const [allSets] = await conn.query('SELECT code FROM instrument_sets WHERE code LIKE "SET-%"');
      const [allItems] = await conn.query('SELECT code FROM items WHERE code LIKE "SET-%"');
      const existingCodeSet = new Set([
        ...allSets.map((r) => String(r.code).toUpperCase()),
        ...allItems.map((r) => String(r.code).toUpperCase()),
      ]);

      let seq = allSets.length + 1;
      let candidate = `SET-${String(seq).padStart(3, '0')}`;
      while (existingCodeSet.has(candidate)) {
        seq++;
        candidate = `SET-${String(seq).padStart(3, '0')}`;
      }
      code = candidate;
    } else {
      // Jika user mengisi kode sendiri, periksa apakah sudah ada di instrument_sets
      const [[dupSet]] = await conn.query('SELECT id FROM instrument_sets WHERE code = ?', [code]);
      if (dupSet) {
        let suffix = 1;
        let candidate = `${code}-${suffix}`;
        while (true) {
          const [[inSets]] = await conn.query('SELECT id FROM instrument_sets WHERE code = ?', [candidate]);
          if (!inSets) break;
          suffix++;
          candidate = `${code}-${suffix}`;
        }
        code = candidate;
      }
    }

    const [result] = await conn.query('INSERT INTO instrument_sets SET ?', [{
      code,
      name: normalizedName,
      completeness_status: completeness,
      missing_notes: missingNotes,
      description,
      is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
    }]);
    const setId = result.insertId;

    if (items.length) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.instrument_name && item.instrument_name.trim()) {
          await conn.query('INSERT INTO instrument_set_items SET ?', [{
            set_id: setId,
            instrument_name: item.instrument_name.trim(),
            quantity: Math.max(parseInt(item.quantity, 10) || 1, 1),
            unit_label: item.unit_label || 'Buah',
            sort_order: i + 1,
          }]);
        }
      }
    }

    // Sinkronisasi otomatis ke master items (agar langsung muncul di transaksi & punya masa steril)
    const [[itemByCode]] = await conn.query('SELECT id, name FROM items WHERE code = ?', [code]);
    const [[itemByName]] = await conn.query('SELECT id, code FROM items WHERE name = ?', [normalizedName]);

    if (itemByCode) {
      await conn.query(
        'UPDATE items SET name = ?, category = "Set Instrumen", process_type = "Steril", unit_label = "Set", description = ? WHERE id = ?',
        [normalizedName, description || 'Set instrumen bedah', itemByCode.id]
      );
    } else if (itemByName) {
      await conn.query(
        'UPDATE items SET code = ?, category = "Set Instrumen", process_type = "Steril", unit_label = "Set", description = ? WHERE id = ?',
        [code, description || 'Set instrumen bedah', itemByName.id]
      );
    } else {
      await conn.query(
        'INSERT INTO items (code, name, process_type, category, unit_label, shelf_life_months, description, is_active) VALUES (?, ?, "Steril", "Set Instrumen", "Set", 6, ?, 1) ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)',
        [code, normalizedName, description || 'Set instrumen bedah']
      );
    }

    return setId;
  });

  const all = await getInstrumentSetsWithStock();
  const created = all.find((s) => s.id === id);
  res.status(201).json({ success: true, message: 'Set instrumen berhasil ditambahkan', data: created });
}));

router.put('/instrument-sets/:id', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const body = req.body || {};
  if (!body.name || !body.name.trim()) throw new HttpError(422, 'Nama set instrumen wajib diisi');
  const normalizedName = body.name.trim().toUpperCase();

  await withTx(async (conn) => {
    const [[existing]] = await conn.query('SELECT * FROM instrument_sets WHERE id = ? FOR UPDATE', [id]);
    if (!existing) throw new HttpError(404, 'Set instrumen tidak ditemukan');

    let code = (body.code && body.code.trim().toUpperCase()) || existing.code;
    if (code !== existing.code) {
      const [[dup]] = await conn.query('SELECT id FROM instrument_sets WHERE code = ? AND id != ?', [code, id]);
      if (dup) {
        let suffix = 1;
        let candidate = `${code}-${suffix}`;
        while (true) {
          const [[inSets]] = await conn.query('SELECT id FROM instrument_sets WHERE code = ? AND id != ?', [candidate, id]);
          if (!inSets) break;
          suffix++;
          candidate = `${code}-${suffix}`;
        }
        code = candidate;
      }
    }

    const updateData = {
      name: normalizedName,
      code,
      completeness_status: body.completeness_status === 'Tidak Lengkap' ? 'Tidak Lengkap' : 'Lengkap',
      missing_notes: body.missing_notes !== undefined ? (body.missing_notes ? String(body.missing_notes).trim() : null) : existing.missing_notes,
      description: body.description !== undefined ? String(body.description).trim() : existing.description,
    };
    if (body.is_active !== undefined) updateData.is_active = body.is_active ? 1 : 0;

    await conn.query('UPDATE instrument_sets SET ? WHERE id = ?', [updateData, id]);

    if (Array.isArray(body.items)) {
      await conn.query('DELETE FROM instrument_set_items WHERE set_id = ?', [id]);
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        if (item.instrument_name && item.instrument_name.trim()) {
          await conn.query('INSERT INTO instrument_set_items SET ?', [{
            set_id: id,
            instrument_name: item.instrument_name.trim(),
            quantity: Math.max(parseInt(item.quantity, 10) || 1, 1),
            unit_label: item.unit_label || 'Buah',
            sort_order: i + 1,
          }]);
        }
      }
    }

    // Sync to items
    const [[itemByOldCode]] = await conn.query('SELECT id FROM items WHERE code = ?', [existing.code]);
    if (itemByOldCode) {
      await conn.query('UPDATE items SET code = ?, name = ?, description = ? WHERE id = ?', [
        code,
        normalizedName,
        updateData.description || 'Set instrumen bedah',
        itemByOldCode.id,
      ]);
    }
  });

  const all = await getInstrumentSetsWithStock();
  const updated = all.find((s) => s.id === id);
  res.json({ success: true, message: 'Set instrumen berhasil diperbarui', data: updated });
}));

router.patch('/instrument-sets/:id/completeness', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const body = req.body || {};
  const status = body.completeness_status === 'Tidak Lengkap' ? 'Tidak Lengkap' : 'Lengkap';
  const missingNotes = body.missing_notes ? String(body.missing_notes).trim() : null;

  const [[existing]] = await pool.query('SELECT * FROM instrument_sets WHERE id = ?', [id]);
  if (!existing) throw new HttpError(404, 'Set instrumen tidak ditemukan');

  await pool.query('UPDATE instrument_sets SET completeness_status = ?, missing_notes = ? WHERE id = ?', [
    status,
    status === 'Lengkap' ? null : missingNotes,
    id,
  ]);

  const all = await getInstrumentSetsWithStock();
  const updated = all.find((s) => s.id === id);
  res.json({
    success: true,
    message: `Status kelengkapan set diubah menjadi ${status}`,
    data: updated,
  });
}));

router.delete('/instrument-sets/:id', auth, allow('admin'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const [[existing]] = await pool.query('SELECT * FROM instrument_sets WHERE id = ?', [id]);
  if (!existing) throw new HttpError(404, 'Set instrumen tidak ditemukan');

  await pool.query('DELETE FROM instrument_sets WHERE id = ?', [id]);
  res.json({ success: true, message: 'Set instrumen berhasil dihapus' });
}));

/* ============================================================
 * CUSTOM ROUTES
 * ============================================================ */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login, coba lagi nanti' },
});

const signToken = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, username: user.username, role: user.role, unit_id: user.unit_id || null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  role: u.role,
  unit_id: u.unit_id || null,
  unit_name: u.unit_name || null,
});

router.get('/health', (req, res) => res.json({ success: true, message: 'CSSD SMART API berjalan', time: new Date().toISOString() }));

router.post('/auth/login', loginLimiter, wrap(async (req, res) => {
  const data = validate(
    [field('username', 'string', { required: true, label: 'Username', max: 50 }), field('password', 'string', { required: true, label: 'Password', max: 72 })],
    req.body
  );
  const [[user]] = await pool.query(
    'SELECT u.*, un.name AS unit_name FROM users u LEFT JOIN units un ON un.id = u.unit_id WHERE u.username = ? AND u.is_active = 1 LIMIT 1',
    [data.username]
  );
  const valid = user && (await bcrypt.compare(data.password, user.password));
  if (!valid) throw new HttpError(401, 'Username atau password salah');
  res.json({ success: true, message: `Selamat datang, ${user.name}`, data: { token: signToken(user), user: publicUser(user) } });
}));

router.post('/auth/register', auth, allow('admin'), wrap(async (req, res) => {
  const data = validate(
    [
      field('name', 'string', { required: true, label: 'Nama', max: 100 }),
      field('username', 'string', { required: true, label: 'Username', min: 3, max: 50 }),
      field('password', 'string', { required: true, label: 'Password', min: 6, max: 72 }),
      field('role', 'enum', { values: ROLES, default: 'petugas', label: 'Role' }),
      field('unit_id', 'int', { label: 'Unit', min: 1 }),
    ],
    req.body
  );
  data.password = await bcrypt.hash(data.password, 10);
  const [result] = await pool.query('INSERT INTO users SET ?', [data]);
  res.status(201).json({ success: true, message: 'Pengguna berhasil didaftarkan', data: { id: result.insertId } });
}));

router.get('/auth/profile', auth, wrap(async (req, res) => {
  const [[user]] = await pool.query(
    'SELECT u.id, u.name, u.username, u.role, u.unit_id, u.is_active, un.name AS unit_name FROM users u LEFT JOIN units un ON un.id = u.unit_id WHERE u.id = ?',
    [req.user.id]
  );
  if (!user || !user.is_active) throw new HttpError(401, 'Akun tidak aktif');
  res.json({ success: true, data: publicUser(user) });
}));

router.put('/auth/password', auth, wrap(async (req, res) => {
  const data = validate(
    [
      field('current_password', 'string', { required: true, label: 'Password saat ini', max: 72 }),
      field('new_password', 'string', { required: true, label: 'Password baru', min: 6, max: 72 }),
    ],
    req.body
  );
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user || !(await bcrypt.compare(data.current_password, user.password))) {
    throw new HttpError(422, 'Password saat ini salah', { current_password: 'Password saat ini salah' });
  }
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(data.new_password, 10), user.id]);
  res.json({ success: true, message: 'Password berhasil diubah' });
}));

// Verifikasi password khusus admin / Kepala Instalasi untuk membuka akses laporan
router.post('/auth/verify-report-access', auth, wrap(async (req, res) => {
  const password = String((req.body && req.body.password) || '').trim();
  if (!password) throw new HttpError(422, 'Password khusus wajib diisi', { password: 'Password khusus wajib diisi' });

  // 1. Cek apakah cocok dengan password akun admin aktif di database
  const [admins] = await pool.query("SELECT id, password FROM users WHERE role = 'admin' AND is_active = 1");
  let valid = false;
  for (const admin of admins) {
    if (await bcrypt.compare(password, admin.password)) {
      valid = true;
      break;
    }
  }

  // 2. Cek juga PIN / password default fallback
  if (!valid && (password === 'admin123' || password === 'cssd123' || password === 'admincssd')) {
    valid = true;
  }

  if (!valid) {
    throw new HttpError(401, 'Password khusus Kepala Instalasi / Admin tidak sesuai');
  }

  res.json({
    success: true,
    message: 'Akses laporan berhasil dibuka',
    data: { unlocked: true, unlocked_at: new Date().toISOString() },
  });
}));

// ---------- Rekap Bulanan Terpadu CSSD SMART ----------
router.get('/reports/monthly-summary', auth, wrap(async (req, res) => {
  const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();

  // 1. Rekap Steril Bulanan
  const [[sterilSummary]] = await pool.query(`
    SELECT
      COUNT(DISTINCT s.id) AS total_batches,
      COUNT(DISTINCT si.packaging_id) AS total_packages,
      COUNT(DISTINCT CASE WHEN v.result = 'Lolos' THEN v.id END) AS passed_verifications,
      COUNT(DISTINCT CASE WHEN v.result = 'Gagal' THEN v.id END) AS failed_verifications
    FROM sterilizations s
    LEFT JOIN sterilization_items si ON si.sterilization_id = s.id
    LEFT JOIN verifications v ON v.sterilization_id = s.id
    WHERE MONTH(s.steril_date) = ? AND YEAR(s.steril_date) = ?
  `, [month, year]);

  const [machineBreakdown] = await pool.query(`
    SELECT COALESCE(m.name, s.machine_id) AS machine_name, COUNT(*) AS batch_count
    FROM sterilizations s
    LEFT JOIN machines m ON m.id = s.machine_id
    WHERE MONTH(s.steril_date) = ? AND YEAR(s.steril_date) = ?
    GROUP BY s.machine_id, m.name
  `, [month, year]);

  // 2. Rekap DTT (RIUS) Bulanan
  const [[dttSummary]] = await pool.query(`
    SELECT
      COUNT(*) AS total_receipts,
      COALESCE(SUM(quantity), 0) AS total_tools_received,
      COUNT(CASE WHEN tool_condition = 'Baik' THEN 1 END) AS condition_baik,
      COUNT(CASE WHEN tool_condition = 'Perlu Perbaikan' THEN 1 END) AS condition_perbaikan,
      COUNT(CASE WHEN tool_condition = 'Rusak / Afkir' OR tool_condition = 'Rusak' THEN 1 END) AS condition_rusak
    FROM dtt_receipts
    WHERE MONTH(receipt_datetime) = ? AND YEAR(receipt_datetime) = ?
  `, [month, year]);

  const [[dttDistSummary]] = await pool.query(`
    SELECT
      COUNT(*) AS total_distributions,
      COALESCE(SUM(quantity), 0) AS total_tools_distributed
    FROM dtt_distributions
    WHERE MONTH(dist_datetime) = ? AND YEAR(dist_datetime) = ?
  `, [month, year]);

  // 3. Rekap Kasa Steril Bulanan
  const [[gauzeSummary]] = await pool.query(`
    SELECT
      COUNT(*) AS total_transactions,
      COALESCE(SUM(quantity), 0) AS total_quantity
    FROM distributions
    WHERE (type = 'KASA' OR gauze_type IS NOT NULL)
      AND MONTH(dist_date) = ? AND YEAR(dist_date) = ?
  `, [month, year]);

  const [gauzeByType] = await pool.query(`
    SELECT COALESCE(gauze_type, 'Kasa Steril') AS gauze_type, SUM(quantity) AS quantity
    FROM distributions
    WHERE (type = 'KASA' OR gauze_type IS NOT NULL)
      AND MONTH(dist_date) = ? AND YEAR(dist_date) = ?
    GROUP BY gauze_type
  `, [month, year]);

  const [gauzeByUnit] = await pool.query(`
    SELECT u.name AS unit_name, SUM(d.quantity) AS quantity
    FROM distributions d
    JOIN units u ON u.id = d.unit_id
    WHERE (d.type = 'KASA' OR d.gauze_type IS NOT NULL)
      AND MONTH(d.dist_date) = ? AND YEAR(d.dist_date) = ?
    GROUP BY d.unit_id, u.name
    ORDER BY quantity DESC
  `, [month, year]);

  // 4. Rekap Seluruh Aktivitas CSSD Bulanan
  const [[overall]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM dirty_receipts WHERE MONTH(receipt_date) = ? AND YEAR(receipt_date) = ?) AS dirty_receipts,
      (SELECT COALESCE(SUM(quantity), 0) FROM dirty_receipts WHERE MONTH(receipt_date) = ? AND YEAR(receipt_date) = ?) AS dirty_items_count,
      (SELECT COUNT(*) FROM washings WHERE MONTH(wash_date) = ? AND YEAR(wash_date) = ?) AS washings_count,
      (SELECT COUNT(*) FROM packagings WHERE MONTH(package_date) = ? AND YEAR(package_date) = ?) AS packagings_count,
      (SELECT COUNT(*) FROM sterilizations WHERE MONTH(steril_date) = ? AND YEAR(steril_date) = ?) AS steril_batches,
      (SELECT COALESCE(SUM(quantity), 0) FROM distributions WHERE (type = 'ALAT' AND (gauze_type IS NULL OR gauze_type = '')) AND MONTH(dist_date) = ? AND YEAR(dist_date) = ?) AS sterile_tools_distributed,
      (SELECT COALESCE(SUM(quantity), 0) FROM distributions WHERE (type = 'KASA' OR gauze_type IS NOT NULL) AND MONTH(dist_date) = ? AND YEAR(dist_date) = ?) AS gauze_distributed,
      (SELECT COUNT(*) FROM dtt_receipts WHERE MONTH(receipt_datetime) = ? AND YEAR(receipt_datetime) = ?) AS dtt_receipts,
      (SELECT COUNT(*) FROM dtt_distributions WHERE MONTH(dist_datetime) = ? AND YEAR(dist_datetime) = ?) AS dtt_distributions,
      (SELECT COALESCE(SUM(quantity), 0) FROM bmhp_transactions WHERE type = 'OUT' AND MONTH(transaction_date) = ? AND YEAR(transaction_date) = ?) AS bmhp_consumed,
      (SELECT COUNT(*) FROM quarantines WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?) AS quarantines_count
  `, [month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year]);

  res.json({
    success: true,
    data: {
      month,
      year,
      steril: {
        ...sterilSummary,
        machines: machineBreakdown,
      },
      dtt: {
        ...dttSummary,
        distributed_count: dttDistSummary.total_distributions,
        distributed_quantity: dttDistSummary.total_tools_distributed,
      },
      gauze: {
        ...gauzeSummary,
        by_type: gauzeByType,
        by_unit: gauzeByUnit,
      },
      overall,
    },
  });
}));

// ---------- BMHP Ringkasan / Summary ----------
router.get('/bmhp-summary', auth, wrap(async (req, res) => {
  const [[summary]] = await pool.query(`
    SELECT
      COUNT(*) AS total_items,
      COALESCE(SUM(stock), 0) AS total_stock,
      COUNT(CASE WHEN stock <= 0 THEN 1 END) AS empty_count,
      COUNT(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 END) AS low_count,
      COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date < CURDATE() THEN 1 END) AS expired_count,
      COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date >= CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 END) AS expiring_count
    FROM bmhp_items
    WHERE is_active = 1
  `);
  res.json({ success: true, data: summary });
}));

// ---------- Dashboard ----------
router.get('/dashboard', auth, wrap(async (req, res) => {
  const isUnit = req.user.role === 'unit';
  const unitId = req.user.unit_id;

  if (isUnit && unitId) {
    // Tampilan khusus Unit Luar: hanya melihat data dan statistik unitnya masing-masing
    const [pipelineRows] = await pool.query(
      "SELECT stage, COUNT(*) AS total FROM dirty_receipts WHERE unit_id = ? AND status IN ('Diterima','Proses') GROUP BY stage",
      [unitId]
    );
    const pipeline = {};
    pipelineRows.forEach((r) => { pipeline[r.stage] = r.total; });

    const [[unitTotals]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM dirty_receipts WHERE unit_id = ? AND receipt_date = CURDATE()) AS received_today,
        0 AS waiting_verification,
        (SELECT COALESCE(SUM(st.quantity), 0)
         FROM sterile_stock st
         JOIN packagings p ON p.id = st.packaging_id
         JOIN dirty_receipts r ON r.id = p.receipt_id
         WHERE r.unit_id = ? AND st.status = 'Tersedia' AND st.expiry_date >= CURDATE()) AS sterile_stock,
        0 AS expired,
        0 AS quarantine,
        0 AS bmhp_low,
        0 AS bmhp_empty,
        0 AS bmhp_expired,
        0 AS bmhp_expiring_soon,
        (SELECT COALESCE(SUM(quantity), 0) FROM distributions WHERE unit_id = ? AND dist_date = CURDATE()) AS distributed_today,
        (SELECT COUNT(*) FROM dtt_receipts WHERE unit_id = ? AND DATE(receipt_datetime) = CURDATE()) AS dtt_received_today,
        (SELECT COUNT(*) FROM dtt_distributions WHERE unit_id = ? AND DATE(dist_datetime) = CURDATE()) AS dtt_distributed_today,
        (SELECT COUNT(*) FROM dirty_receipts WHERE unit_id = ? AND status IN ('Diterima','Proses')) AS active_processes
    `, [unitId, unitId, unitId, unitId, unitId, unitId]);

    const [dttActive] = await pool.query(
      "SELECT COUNT(*) AS total FROM dtt_receipts WHERE unit_id = ? AND process_stage != 'Selesai'",
      [unitId]
    );

    const unitActiveProcesses = (Number(unitTotals.active_processes) || 0) + (Number(dttActive[0]?.total) || 0);
    const unitTodayTx = (Number(unitTotals.received_today) || 0) + (Number(unitTotals.distributed_today) || 0) + (Number(unitTotals.dtt_received_today) || 0) + (Number(unitTotals.dtt_distributed_today) || 0);

    res.json({
      success: true,
      data: {
        pipeline,
        totals: {
          ...unitTotals,
          dtt_active: dttActive[0]?.total || 0,
          active_processes: unitActiveProcesses,
          today_transactions: unitTodayTx,
        },
        expiring: [],
        lowBmhp: [],
        recentVerifications: [],
        recentQuarantines: [],
      },
    });
    return;
  }

  // Petugas CSSD / Admin: Akses penuh
  const [pipelineRows] = await pool.query("SELECT stage, COUNT(*) AS total FROM dirty_receipts WHERE status IN ('Diterima','Proses') GROUP BY stage");
  const pipeline = {};
  pipelineRows.forEach((r) => { pipeline[r.stage] = r.total; });

  const [[totals]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM dirty_receipts WHERE receipt_date = CURDATE()) AS received_today,
      (SELECT COUNT(*) FROM sterilizations WHERE status = 'Menunggu Verifikasi') AS waiting_verification,
      (SELECT COALESCE(SUM(quantity), 0) FROM sterile_stock WHERE status = 'Tersedia' AND expiry_date >= CURDATE()) AS sterile_stock,
      (SELECT COUNT(*) FROM sterile_stock WHERE status = 'Tersedia' AND expiry_date < CURDATE()) AS expired,
      (SELECT COUNT(*) FROM quarantines WHERE status = 'Karantina') AS quarantine,
      (SELECT COUNT(*) FROM bmhp_items WHERE is_active = 1 AND stock <= min_stock AND stock > 0) AS bmhp_low,
      (SELECT COUNT(*) FROM bmhp_items WHERE is_active = 1 AND stock <= 0) AS bmhp_empty,
      (SELECT COUNT(*) FROM bmhp_items WHERE is_active = 1 AND expiry_date IS NOT NULL AND expiry_date < CURDATE()) AS bmhp_expired,
      (SELECT COUNT(*) FROM bmhp_items WHERE is_active = 1 AND expiry_date IS NOT NULL AND expiry_date >= CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS bmhp_expiring_soon,
      (SELECT COALESCE(SUM(quantity), 0) FROM distributions WHERE dist_date = CURDATE()) AS distributed_today,
      (SELECT COUNT(*) FROM dtt_receipts WHERE process_stage != 'Selesai') AS dtt_active,
      (SELECT COUNT(*) FROM dtt_receipts WHERE DATE(receipt_datetime) = CURDATE()) AS dtt_received_today,
      (SELECT COUNT(*) FROM dtt_distributions WHERE DATE(dist_datetime) = CURDATE()) AS dtt_distributed_today,
      (SELECT COUNT(*) FROM dirty_receipts WHERE status IN ('Diterima','Proses')) AS active_processes,
      (SELECT COALESCE(SUM(stock), 0) FROM bmhp_items WHERE is_active = 1) AS bmhp_stock_total,
      (SELECT COALESCE(SUM(quantity), 0) FROM distributions WHERE dist_date = CURDATE() AND (type = 'KASA' OR gauze_type IS NOT NULL)) AS gauze_distributed_today
  `);

  const totalActiveProcesses = (Number(totals.active_processes) || 0) + (Number(totals.dtt_active) || 0);
  const totalTodayTx = (Number(totals.received_today) || 0) + (Number(totals.distributed_today) || 0) + (Number(totals.dtt_received_today) || 0) + (Number(totals.dtt_distributed_today) || 0);
  totals.active_processes = totalActiveProcesses;
  totals.today_transactions = totalTodayTx;

  const [expiring] = await pool.query(
    "SELECT id, barcode, item_name, expiry_date, quantity, unit_label, DATEDIFF(expiry_date, CURDATE()) AS days_left FROM sterile_stock WHERE status = 'Tersedia' AND quantity > 0 AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) ORDER BY expiry_date ASC LIMIT 5"
  );
  const [lowBmhp] = await pool.query(`
    SELECT id, code, name, stock, min_stock, unit_label, category, batch_no, expiry_date,
      (stock <= 0) AS is_empty,
      (stock > 0 AND stock <= min_stock) AS is_low,
      DATEDIFF(expiry_date, CURDATE()) AS days_left
    FROM bmhp_items
    WHERE is_active = 1 AND (stock <= min_stock OR (expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)))
    ORDER BY (stock <= 0) DESC, (stock <= min_stock) DESC, (expiry_date IS NOT NULL AND expiry_date < CURDATE()) DESC, expiry_date ASC
    LIMIT 6
  `);
  const [recentVerifications] = await pool.query(
    'SELECT v.id, v.result, v.verify_date, s.batch_no, v.fail_reason FROM verifications v JOIN sterilizations s ON s.id = v.sterilization_id ORDER BY v.id DESC LIMIT 5'
  );
  const [recentQuarantines] = await pool.query("SELECT id, barcode, batch_no, reason, created_at FROM quarantines WHERE status = 'Karantina' ORDER BY id DESC LIMIT 5");

  res.json({ success: true, data: { pipeline, totals, expiring, lowBmhp, recentVerifications, recentQuarantines } });
}));

// Status Pemantauan Unit (untuk scan Barcode Loket oleh kamera HP petugas unit)
router.get('/public/unit-status/:id', wrap(async (req, res) => {
  const unitId = parseId(req.params.id);
  const [[unit]] = await pool.query('SELECT id, code, name FROM units WHERE id = ? AND is_active = 1', [unitId]);
  if (!unit) throw new HttpError(404, 'Unit tidak ditemukan atau nonaktif');

  // 1. Alat kotor yang sedang dalam proses CSSD (Pencucian -> Verifikasi)
  const [inProcess] = await pool.query(`
    SELECT r.id, r.barcode, r.receipt_date, r.item_name, r.quantity, r.unit_label, r.stage, r.status, r.receiver_name
    FROM dirty_receipts r
    WHERE r.unit_id = ? AND r.status IN ('Diterima', 'Proses')
    ORDER BY r.id DESC LIMIT 50
  `, [unitId]);

  // 2. Alat steril yang SUDAH SIAP DIAMBIL di CSSD
  const [readySterile] = await pool.query(`
    SELECT st.id, st.barcode, st.item_name, st.quantity, st.unit_label, st.expiry_date, st.status,
           p.pack_date, p.material
    FROM sterile_stock st
    JOIN packagings p ON p.id = st.packaging_id
    JOIN dirty_receipts r ON r.id = p.receipt_id
    WHERE r.unit_id = ? AND st.status = 'Tersedia' AND st.expiry_date >= CURDATE()
    ORDER BY st.expiry_date ASC LIMIT 50
  `, [unitId]);

  // 3. Alat DTT yang SUDAH SELESAI & SIAP DIAMBIL
  const [readyDtt] = await pool.query(`
    SELECT d.id, d.barcode, d.item_name, d.quantity, d.unit_label, d.receipt_datetime, d.process_stage, d.officer_cssd
    FROM dtt_receipts d
    WHERE d.unit_id = ? AND d.process_stage IN ('Selesai Steril/DTT', 'Siap Distribusi', 'Selesai')
    AND d.id NOT IN (SELECT receipt_id FROM dtt_distributions WHERE unit_id = ?)
    ORDER BY d.id DESC LIMIT 50
  `, [unitId, unitId]);

  // 4. Riwayat transaksi terakhir unit
  const [recentReceipts] = await pool.query(`
    SELECT 'Penerimaan Alat Kotor' AS jenis, barcode, receipt_date AS tanggal, item_name, quantity, unit_label, receiver_name AS petugas
    FROM dirty_receipts WHERE unit_id = ? ORDER BY id DESC LIMIT 5
  `, [unitId]);

  const [recentDistributions] = await pool.query(`
    SELECT 'Pengambilan Alat Steril' AS jenis, st.barcode, d.dist_date AS tanggal, st.item_name, d.quantity, st.unit_label, d.officer_unit AS petugas
    FROM distributions d
    JOIN sterile_stock st ON st.id = d.stock_id
    WHERE d.unit_id = ? ORDER BY d.id DESC LIMIT 5
  `, [unitId]);

  const [recentDtt] = await pool.query(`
    SELECT 'Pengambilan Alat DTT' AS jenis, dd.barcode, dd.dist_datetime AS tanggal, dd.item_name, dd.quantity, dd.unit_label, dd.officer_unit AS petugas
    FROM dtt_distributions dd
    WHERE dd.unit_id = ? ORDER BY dd.id DESC LIMIT 5
  `, [unitId]);

  const recentHistory = [...recentReceipts, ...recentDistributions, ...recentDtt]
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    .slice(0, 10);

  res.json({
    success: true,
    data: {
      unit,
      inProcess,
      readySterile,
      readyDtt,
      recentHistory,
    },
  });
}));

// ---------- Ketertelusuran ----------
async function buildTrace(receiptId) {
  const [[receipt]] = await pool.query(
    'SELECT r.*, u.name AS unit_name FROM dirty_receipts r LEFT JOIN units u ON u.id = r.unit_id WHERE r.id = ?',
    [receiptId]
  );
  if (!receipt) return null;
  const [washings] = await pool.query('SELECT * FROM washings WHERE receipt_id = ? ORDER BY id', [receiptId]);
  const [dryings] = await pool.query('SELECT * FROM dryings WHERE receipt_id = ? ORDER BY id', [receiptId]);
  const [packages] = await pool.query(
    `SELECT p.*, s.id AS sterilization_id, s.batch_no, s.cycle_no, s.steril_date, s.temperature, s.duration_min,
            s.officer AS steril_officer, m.name AS machine_name,
            v.result, v.verify_date, v.officer AS verify_officer, v.fail_reason
     FROM packagings p
     LEFT JOIN sterilization_items si ON si.packaging_id = p.id
     LEFT JOIN sterilizations s ON s.id = si.sterilization_id
     LEFT JOIN machines m ON m.id = s.machine_id
     LEFT JOIN verifications v ON v.sterilization_id = s.id
     WHERE p.receipt_id = ? ORDER BY p.id, s.id`,
    [receiptId]
  );
  const [distributions] = await pool.query(
    `SELECT d.*, u.name AS unit_name FROM distributions d
     JOIN sterile_stock st ON st.id = d.stock_id
     JOIN packagings p ON p.id = st.packaging_id
     JOIN units u ON u.id = d.unit_id
     WHERE p.receipt_id = ? ORDER BY d.id`,
    [receiptId]
  );

  const timeline = [{ order: 1, stage: 'Alat Kotor Masuk', date: receipt.receipt_date, officer: `${receipt.sender_name} → ${receipt.receiver_name}`, detail: `${receipt.item_name} (${receipt.quantity} ${receipt.unit_label}) dari ${receipt.unit_name}`, status: 'ok' }];
  washings.forEach((w) => timeline.push({ order: 2, stage: 'Pencucian', date: w.wash_date, officer: w.officer, detail: `${w.method}${w.liquid ? `, ${w.liquid}` : ''}${w.duration_min ? `, ${w.duration_min} menit` : ''}`, status: 'ok' }));
  dryings.forEach((d) => {
    const passed = d.is_dry && d.no_rust && d.function_ok;
    timeline.push({ order: 3, stage: 'Pengeringan & Pemeriksaan', date: d.dry_date, officer: d.officer, detail: passed ? 'Kering, tidak berkarat, fungsi baik' : 'Tidak lolos pemeriksaan, dicuci ulang', status: passed ? 'ok' : 'fail' });
  });
  const seenPackages = new Set();
  packages.forEach((p) => {
    if (!seenPackages.has(p.id)) {
      seenPackages.add(p.id);
      timeline.push({ order: 4, stage: 'Pengemasan', date: p.pack_date, officer: p.officer, detail: `${p.barcode} — ${p.package_type}, ${p.material}, ${p.quantity} ${p.unit_label}`, status: 'ok' });
    }
    if (p.sterilization_id) {
      timeline.push({ order: 5, stage: 'Sterilisasi', date: p.steril_date, officer: p.steril_officer, detail: `${p.barcode} — ${p.machine_name}, siklus ${p.cycle_no}, batch ${p.batch_no}, ${p.temperature}°C ${p.duration_min} menit`, status: 'ok' });
    }
    if (p.result) {
      timeline.push({ order: 6, stage: 'Verifikasi', date: p.verify_date, officer: p.verify_officer, detail: `${p.barcode} — ${p.result}${p.fail_reason ? `: ${p.fail_reason}` : ''}`, status: p.result === 'LULUS' ? 'ok' : 'fail' });
    }
  });
  distributions.forEach((d) => timeline.push({ order: 8, stage: d.type === 'KASA' ? 'Distribusi Kasa Steril' : 'Distribusi Alat Steril', date: d.dist_date, officer: d.officer, detail: `${d.barcode} — ${d.quantity} ke ${d.unit_name}`, status: 'ok' }));

  timeline.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
  return { receipt, timeline };
}

async function buildDttTrace(dttReceiptId) {
  const [[receipt]] = await pool.query(
    'SELECT r.*, u.name AS unit_name FROM dtt_receipts r LEFT JOIN units u ON u.id = r.unit_id WHERE r.id = ?',
    [dttReceiptId]
  );
  if (!receipt) return null;
  const [distributions] = await pool.query(
    'SELECT d.*, u.name AS unit_name FROM dtt_distributions d LEFT JOIN units u ON u.id = d.unit_id WHERE d.dtt_receipt_id = ? ORDER BY d.id',
    [dttReceiptId]
  );

  const timeline = [
    {
      order: 1,
      stage: 'Penerimaan Alat Kotor DTT (RIUS)',
      date: (receipt.receipt_datetime || '').slice(0, 10),
      officer: `${receipt.sender_name} → ${receipt.receiver_name}`,
      detail: `${receipt.barcode} — ${receipt.item_name} (${receipt.quantity} ${receipt.unit_label}) • Pemakaian ke-${receipt.reuse_count} • Kondisi: ${receipt.tool_condition}`,
      status: 'ok',
    },
    {
      order: 2,
      stage: 'Pencucian & DTT',
      date: (receipt.receipt_datetime || '').slice(0, 10),
      officer: receipt.receiver_name,
      detail: `${receipt.dtt_method} • Cairan: ${receipt.dtt_liquid} • Waktu: ${receipt.dtt_duration_min} menit`,
      status: 'ok',
    },
    {
      order: 3,
      stage: 'Verifikasi & Penyimpanan DTT',
      date: (receipt.receipt_datetime || '').slice(0, 10),
      officer: receipt.receiver_name,
      detail: `Hasil Verifikasi: ${receipt.verification_result} • Status: ${receipt.process_stage}`,
      status: receipt.verification_result === 'Gagal / Cuci Ulang' ? 'fail' : 'ok',
    },
  ];

  distributions.forEach((d) => {
    timeline.push({
      order: 4,
      stage: 'Distribusi Alat Hasil DTT (RIUS)',
      date: (d.dist_datetime || '').slice(0, 10),
      officer: `${d.officer} → ${d.receiver_name}`,
      detail: `${d.barcode} — ${d.quantity} ${d.unit_label} ke ${d.unit_name} (Pemakaian ke-${d.reuse_count})`,
      status: 'ok',
    });
  });

  return {
    receipt: {
      ...receipt,
      receipt_date: (receipt.receipt_datetime || '').slice(0, 10),
      is_dtt: true,
    },
    timeline,
  };
}

router.get('/traceability', auth, wrap(async (req, res) => {
  const code = sanitizeText(req.query.barcode || '').slice(0, 50);
  if (!code) throw new HttpError(422, 'Barcode wajib diisi', { barcode: 'Barcode wajib diisi' });

  // 1. Cek Transaksi DTT (RIUS)
  const [dttByReceipt] = await pool.query('SELECT id FROM dtt_receipts WHERE barcode = ?', [code]);
  const [dttByDist] = await pool.query('SELECT dtt_receipt_id AS id FROM dtt_distributions WHERE barcode = ?', [code]);
  const dttIds = [...new Set([...dttByReceipt, ...dttByDist].map((r) => r.id))];

  if (dttIds.length > 0) {
    let traces = (await Promise.all(dttIds.map(buildDttTrace))).filter(Boolean);
    if (req.user.role === 'unit' && req.user.unit_id) {
      traces = traces.filter((t) => t.receipt.unit_id === req.user.unit_id);
    }
    if (!traces.length) throw new HttpError(404, 'Data tidak ditemukan atau tidak memiliki akses');
    return res.json({ success: true, data: traces });
  }

  // 2. Cek Barcode Transaksi BMHP (Khusus Internal CSSD)
  if (req.user.role !== 'unit') {
    const [bmhpItem] = await pool.query('SELECT * FROM bmhp_items WHERE code = ? LIMIT 1', [code]);
    if (bmhpItem.length > 0) {
      const item = bmhpItem[0];
      const [txs] = await pool.query('SELECT * FROM bmhp_transactions WHERE item_id = ? ORDER BY id DESC LIMIT 10', [item.id]);
      return res.json({
        success: true,
        data: [{
          receipt: {
            id: item.id,
            barcode: item.code,
            item_name: item.name,
            quantity: item.stock,
            unit_label: item.unit_label,
            unit_name: 'Gudang BMHP CSSD',
            stage: 'BMHP',
            status: item.stock <= 0 ? 'Habis' : item.stock <= item.min_stock ? 'Menipis' : 'Tersedia',
          },
          timeline: [
            {
              stage: 'Stok Terdaftar',
              date: item.created_at,
              detail: `Stok saat ini: ${item.stock} ${item.unit_label} (Min: ${item.min_stock}). Batch: ${item.batch_no || '-'}, Exp: ${item.expiry_date || '-'}`,
              officer: 'Logistik CSSD',
            },
            ...txs.map((t) => ({
              stage: t.type === 'IN' ? 'Barang Masuk' : 'Barang Keluar',
              date: t.transaction_date,
              detail: `${t.type === 'IN' ? '+' : '-'}${t.quantity} ${item.unit_label} • ${t.notes || '-'}`,
              officer: t.officer,
            })),
          ],
        }],
      });
    }
  }

  // 3. Cek Transaksi CSSD Standar (Alat Kotor, Paket, Distribusi, Batch)
  const [byReceipt] = await pool.query('SELECT id FROM dirty_receipts WHERE barcode = ?', [code]);
  const [byPackage] = await pool.query('SELECT receipt_id AS id FROM packagings WHERE barcode = ?', [code]);
  const [byDist] = await pool.query(
    'SELECT p.receipt_id AS id FROM distributions d JOIN sterile_stock s ON s.id = d.stock_id JOIN packagings p ON p.id = s.packaging_id WHERE d.barcode = ?',
    [code]
  );
  const [byBatch] = await pool.query(
    `SELECT DISTINCT p.receipt_id AS id FROM sterilizations s
     JOIN sterilization_items si ON si.sterilization_id = s.id
     JOIN packagings p ON p.id = si.packaging_id WHERE s.batch_no = ?`,
    [code]
  );
  const ids = [...new Set([...byReceipt, ...byPackage, ...byDist, ...byBatch].map((r) => r.id))].slice(0, 20);
  if (!ids.length) throw new HttpError(404, 'Barcode / batch tidak ditemukan');

  let traces = (await Promise.all(ids.map(buildTrace))).filter(Boolean);
  if (req.user.role === 'unit' && req.user.unit_id) {
    traces = traces.filter((t) => t.receipt.unit_id === req.user.unit_id);
  }
  if (!traces.length) throw new HttpError(404, 'Data tidak ditemukan atau tidak memiliki akses');
  res.json({ success: true, data: traces });
}));

// ---------- Upload ----------
const EXT_BY_MAGIC = [
  { ext: '.png', test: (b) => b.length > 8 && b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  { ext: '.jpg', test: (b) => b.length > 3 && b.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  { ext: '.webp', test: (b) => b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
];

function saveImageBuffer(buffer, folder) {
  const match = EXT_BY_MAGIC.find((m) => m.test(buffer));
  if (!match) throw new HttpError(400, 'File harus berupa gambar PNG, JPG, atau WEBP yang valid');
  const name = `${crypto.randomBytes(16).toString('hex')}${match.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, folder, name), buffer, { flag: 'wx' });
  return `${folder}/${name}`;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

router.post('/uploads/image', auth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'File tidak ditemukan');
  res.status(201).json({ success: true, message: 'Gambar berhasil diunggah', data: { path: saveImageBuffer(req.file.buffer, 'images') } });
}));

router.post('/uploads/signature', auth, wrap(async (req, res) => {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body && req.body.data) || ''));
  if (!match) throw new HttpError(400, 'Data tanda tangan tidak valid');
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length > 300 * 1024) throw new HttpError(413, 'Ukuran tanda tangan terlalu besar');
  res.status(201).json({ success: true, message: 'Tanda tangan tersimpan', data: { path: saveImageBuffer(buffer, 'signatures') } });
}));

/* ============================================================
 * APP
 * ============================================================ */
const app = express();
app.disable('x-powered-by');
if (IS_PROD) app.set('trust proxy', 1);

const corsOrigins = (env.CORS_ORIGIN || '*').split(',').map((o) => o.trim()).filter(Boolean);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: corsOrigins.includes('*') ? true : corsOrigins }));
app.use(express.json({ limit: '1mb' }));

app.use(`/${UPLOAD_FOLDER}`, express.static(UPLOAD_DIR, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));

app.use('/api', router);
app.use('/api', (req, res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message, errors: err.errors });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Format JSON tidak valid' });
  if (err.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Ukuran data terlalu besar' });
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 2 MB' : 'Upload file gagal';
    return res.status(400).json({ success: false, message });
  }
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return res.status(409).json({ success: false, message: 'Data sudah terdaftar (kode, barcode, atau username tidak boleh duplikat)' });
    case 'ER_NO_REFERENCED_ROW_2':
      return res.status(422).json({ success: false, message: 'Referensi data tidak valid' });
    case 'ER_ROW_IS_REFERENCED_2':
      return res.status(409).json({ success: false, message: 'Data tidak dapat dihapus karena masih digunakan data lain' });
    default:
      console.error(err);
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

async function ensureAdmin() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users');
  if (total > 0) return;
  const username = env.ADMIN_USERNAME || 'admin';
  const password = env.ADMIN_PASSWORD || 'admin123';
  await pool.query('INSERT INTO users SET ?', [{
    name: env.ADMIN_NAME || 'Administrator',
    username,
    password: await bcrypt.hash(password, 10),
    role: 'admin',
  }]);
  console.log(`Akun admin awal dibuat: ${username} (segera ganti password setelah login)`);
}

async function ensureOfficersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS officers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      nip VARCHAR(50) DEFAULT NULL,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'Petugas CSSD',
      phone VARCHAR(30) DEFAULT NULL,
      signature VARCHAR(255) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_officers_active (is_active),
      KEY idx_officers_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM officers');
  if (total === 0) {
    await pool.query(`
      INSERT INTO officers (nip, name, role, phone) VALUES
      ('PEG-001', 'Inge Kusryaningsih', 'Petugas CSSD', '081234567890'),
      ('PEG-002', 'Rahma', 'Petugas Penerima CSSD', '081234567891'),
      ('PEG-003', 'Zamra', 'Petugas Pengeringan', '081234567892'),
      ('PEG-004', 'Inge', 'Petugas CSSD', '081234567894'),
      ('PEG-005', 'Budi Santoso', 'Operator Sterilisasi', '081234567893')
    `);
  }
}

async function ensureInstrumentSetsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instrument_sets (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(150) NOT NULL,
      completeness_status ENUM('Lengkap','Tidak Lengkap') NOT NULL DEFAULT 'Lengkap',
      missing_notes VARCHAR(255) DEFAULT NULL,
      description VARCHAR(255) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_instrument_sets_code (code),
      KEY idx_instrument_sets_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS instrument_set_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      set_id INT UNSIGNED NOT NULL,
      instrument_name VARCHAR(150) NOT NULL,
      quantity INT UNSIGNED NOT NULL DEFAULT 1,
      unit_label VARCHAR(30) NOT NULL DEFAULT 'Buah',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_set_items_set_id (set_id),
      CONSTRAINT fk_set_items_set FOREIGN KEY (set_id) REFERENCES instrument_sets (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM instrument_sets');
  if (total === 0) {
    const [r1] = await pool.query(`
      INSERT INTO instrument_sets (code, name, completeness_status, description)
      VALUES ('SET-LAP', 'SET LAPAROTOMI', 'Lengkap', 'Set instrumen bedah laparotomi mayor')
    `);
    const set1 = r1.insertId;
    await pool.query(`
      INSERT INTO instrument_set_items (set_id, instrument_name, quantity, unit_label, sort_order) VALUES
      (?, 'Pinset anatomis', 2, 'Buah', 1),
      (?, 'Pinset sirurgis', 2, 'Buah', 2),
      (?, 'Gunting Mayo', 2, 'Buah', 3),
      (?, 'Klem Pean', 6, 'Buah', 4),
      (?, 'Needle holder', 2, 'Buah', 5)
    `, [set1, set1, set1, set1, set1]);

    const [r2] = await pool.query(`
      INSERT INTO instrument_sets (code, name, completeness_status, description)
      VALUES ('SET-MNR', 'SET MINOR', 'Lengkap', 'Set bedah minor rawat jalan & IGD')
    `);
    const set2 = r2.insertId;
    await pool.query(`
      INSERT INTO instrument_set_items (set_id, instrument_name, quantity, unit_label, sort_order) VALUES
      (?, 'Gunting bedah lurus', 1, 'Buah', 1),
      (?, 'Gunting bedah bengkok', 1, 'Buah', 2),
      (?, 'Pinset anatomis', 2, 'Buah', 3),
      (?, 'Pinset sirurgis', 2, 'Buah', 4),
      (?, 'Klem arteri Pean', 2, 'Buah', 5),
      (?, 'Needle holder', 1, 'Buah', 6),
      (?, 'Bak instrumen', 1, 'Buah', 7)
    `, [set2, set2, set2, set2, set2, set2, set2]);

    const [r3] = await pool.query(`
      INSERT INTO instrument_sets (code, name, completeness_status, description)
      VALUES ('SET-SC', 'SET SECTIO CAESAREA', 'Lengkap', 'Set bedah sesar / SC kamar operasi VK')
    `);
    const set3 = r3.insertId;
    await pool.query(`
      INSERT INTO instrument_set_items (set_id, instrument_name, quantity, unit_label, sort_order) VALUES
      (?, 'Pinset sirurgis', 2, 'Buah', 1),
      (?, 'Pinset anatomis', 2, 'Buah', 2),
      (?, 'Gunting Metzenbaum', 2, 'Buah', 3),
      (?, 'Gunting Mayo', 2, 'Buah', 4),
      (?, 'Klem Kocher', 4, 'Buah', 5),
      (?, 'Klem Pean', 4, 'Buah', 6),
      (?, 'Needle holder', 2, 'Buah', 7),
      (?, 'Retraktor Abdomen', 2, 'Buah', 8),
      (?, 'Ring forceps / Klem kassa', 2, 'Buah', 9)
    `, [set3, set3, set3, set3, set3, set3, set3, set3, set3]);

    const [r4] = await pool.query(`
      INSERT INTO instrument_sets (code, name, completeness_status, missing_notes, description)
      VALUES ('SET-PRT', 'SET PARTUS', 'Tidak Lengkap', 'Gunting episiotomi kurang 1 pcs dalam perbaikan teknisi', 'Set pertolongan persalinan normal')
    `);
    const set4 = r4.insertId;
    await pool.query(`
      INSERT INTO instrument_set_items (set_id, instrument_name, quantity, unit_label, sort_order) VALUES
      (?, 'Gunting episiotomi', 1, 'Buah', 1),
      (?, 'Gunting tali pusat', 1, 'Buah', 2),
      (?, 'Klem tali pusat', 2, 'Buah', 3),
      (?, 'Pinset anatomis', 1, 'Buah', 4),
      (?, 'Needle holder', 1, 'Buah', 5),
      (?, 'Catheter nelaton', 1, 'Buah', 6),
      (?, 'Setengah kocher', 1, 'Buah', 7)
    `, [set4, set4, set4, set4, set4, set4, set4]);
  }

  // Sinkronisasi otomatis instrument_sets ke master items
  await pool.query(`
    INSERT INTO items (code, name, category, shelf_life_months, description)
    SELECT s.code, s.name, 'Set Instrumen', 6, s.description
    FROM instrument_sets s
    WHERE NOT EXISTS (
      SELECT 1 FROM items i WHERE i.code = s.code OR i.name = s.name
    )
  `).catch(() => {});
}

async function ensureCategoryMigration() {
  try {
    // 1. Perluas ENUM jika belum mencakup 4 kategori baru
    await pool.query(`
      ALTER TABLE items MODIFY COLUMN category ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL
    `);
    await pool.query(`
      ALTER TABLE packagings MODIFY COLUMN package_type ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL
    `);
    await pool.query(`
      ALTER TABLE sterile_stock MODIFY COLUMN category ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL
    `);

    // 2. Migrasi data lama dari 'Instrumen / Set Alat'
    await pool.query(`
      UPDATE items SET category = CASE 
        WHEN name LIKE '%Set%' OR name LIKE '%SET%' OR code LIKE 'SET%' OR code LIKE 'INS%' THEN 'Set Instrumen'
        ELSE 'Alat Satuan'
      END WHERE category = 'Instrumen / Set Alat'
    `);
    await pool.query(`
      UPDATE packagings SET package_type = CASE
        WHEN material = 'Container' OR unit_label = 'set' THEN 'Set Instrumen'
        ELSE 'Alat Satuan'
      END WHERE package_type = 'Instrumen / Set Alat'
    `);
    await pool.query(`
      UPDATE sterile_stock SET category = CASE
        WHEN item_name LIKE '%Set%' OR item_name LIKE '%SET%' OR unit_label = 'set' THEN 'Set Instrumen'
        ELSE 'Alat Satuan'
      END WHERE category = 'Instrumen / Set Alat'
    `);

    // 3. Kunci ENUM 4 kategori
    await pool.query(`
      ALTER TABLE items MODIFY COLUMN category ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL
    `);
    await pool.query(`
      ALTER TABLE packagings MODIFY COLUMN package_type ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL
    `);
    await pool.query(`
      ALTER TABLE sterile_stock MODIFY COLUMN category ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL
    `);
  } catch (e) {
    // Abaikan jika sudah termigrasi atau tabel belum ada
  }
}

async function ensureDiscrepancyTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS instrument_discrepancy_logs (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        set_id INT UNSIGNED NOT NULL,
        instrument_name VARCHAR(150) NOT NULL,
        incident_type ENUM('Kurang', 'Hilang', 'Rusak', 'Ditemukan Kembali', 'Diganti Baru') NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        unit_origin VARCHAR(100) DEFAULT NULL,
        officer VARCHAR(100) NOT NULL,
        incident_date DATE NOT NULL,
        notes TEXT DEFAULT NULL,
        resolution_status ENUM('Belum Selesai', 'Selesai') NOT NULL DEFAULT 'Belum Selesai',
        resolution_notes TEXT DEFAULT NULL,
        resolved_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_disc_set_id (set_id),
        KEY idx_disc_status (resolution_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM instrument_discrepancy_logs');
    if (total === 0) {
      await pool.query(`
        INSERT INTO instrument_discrepancy_logs 
        (set_id, instrument_name, incident_type, quantity, unit_origin, officer, incident_date, notes, resolution_status)
        VALUES
        (4, 'Gunting episiotomi', 'Rusak', 1, 'Ruang Bersalin (VK)', 'Inge Kusryaningsih', CURDATE(), 'Gunting episiotomi mata gunting tumpul / dalam perbaikan teknisi', 'Belum Selesai')
      `);
    }
  } catch (err) {
    console.error('ensureDiscrepancyTable notice:', err.message);
  }
}

async function ensurePackagingMaterialsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS packaging_materials (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(30) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_pkg_mat_code (code),
        KEY idx_pkg_mat_name (name),
        KEY idx_pkg_mat_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM packaging_materials');
    if (total === 0) {
      await pool.query(`
        INSERT INTO packaging_materials (code, name, description, is_active) VALUES
        ('SMS', 'SMS Wrap', 'Kain pembungkus SMS non-woven standar CSSD', 1),
        ('POUCH', 'Pouch', 'Kantung sterilisasi kertas / film transparan', 1),
        ('CONT', 'Container', 'Kotak kontainer instrumen tahan panas', 1),
        ('LINEN', 'Linen', 'Kain katun / linen pembungkus alat steril', 1),
        ('KREP', 'Kertas Krep', 'Kertas krep medikal untuk pembungkus', 1)
      `);
    }
  } catch (err) {
    console.error('ensurePackagingMaterialsTable notice:', err.message);
  }
}

async function ensureMachineTypeMigration() {
  try {
    await pool.query('ALTER TABLE machines MODIFY COLUMN type VARCHAR(50) NOT NULL');
  } catch (err) {
    // Abaikan jika sudah VARCHAR(50)
  }
}

async function ensureBmhpColumns() {
  try {
    const addCol = async (table, colDef) => {
      try {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (err) {
        if (err.errno !== 1060 && !err.message.includes('Duplicate column name')) {
          console.error(`ensureBmhpColumns notice on ${table}:`, err.message);
        }
      }
    };

    await addCol('bmhp_items', "category VARCHAR(100) DEFAULT 'Kemasan & Pembungkus'");
    await addCol('bmhp_items', 'item_type VARCHAR(100) DEFAULT NULL');
    await addCol('bmhp_items', 'specification VARCHAR(255) DEFAULT NULL');
    await addCol('bmhp_items', 'package_volume VARCHAR(100) DEFAULT NULL');
    await addCol('bmhp_items', 'initial_stock INT NOT NULL DEFAULT 0');
    await addCol('bmhp_items', 'batch_no VARCHAR(50) DEFAULT NULL');
    await addCol('bmhp_items', 'expiry_date DATE DEFAULT NULL');

    await addCol('bmhp_transactions', 'expiry_date DATE DEFAULT NULL');

    await pool.query(`
      UPDATE bmhp_items 
      SET initial_stock = stock 
      WHERE initial_stock = 0 
        AND stock > 0 
        AND id NOT IN (SELECT DISTINCT bmhp_item_id FROM bmhp_transactions WHERE type = 'MASUK')
    `);

    await pool.query(`
      UPDATE bmhp_items SET 
        category = 'Kemasan Steril',
        item_type = 'Pouch Sterilisasi',
        specification = '100mm x 200m Film/Kertas Transparan',
        package_volume = '1 Roll = 200 Meter',
        batch_no = 'LOT-2610-A',
        expiry_date = DATE_ADD(CURDATE(), INTERVAL 365 DAY)
      WHERE code = 'BMHP-001' AND (specification IS NULL OR specification = '')
    `);

    await pool.query(`
      UPDATE bmhp_items SET 
        category = 'Indikator Kimia & Biologi',
        item_type = 'Chemical Indicator Tape',
        specification = 'Autoklaf Steam Kelas 1 (19mm x 50m)',
        package_volume = '1 Roll = 50 Meter',
        batch_no = 'LOT-2609-B',
        expiry_date = DATE_ADD(CURDATE(), INTERVAL 180 DAY)
      WHERE code = 'BMHP-002' AND (specification IS NULL OR specification = '')
    `);

    await pool.query(`
      UPDATE bmhp_items SET 
        category = 'Indikator Kimia & Biologi',
        item_type = 'Biological Indicator',
        specification = 'G. stearothermophilus 10^6 Spora',
        package_volume = '1 Box = 50 Ampul',
        batch_no = 'LOT-2608-C',
        expiry_date = DATE_ADD(CURDATE(), INTERVAL 15 DAY)
      WHERE code = 'BMHP-003' AND (specification IS NULL OR specification = '')
    `);

    await pool.query(`
      UPDATE bmhp_items SET 
        category = 'Kemasan Steril',
        item_type = 'Wrap SMS Non-Woven',
        specification = '60 cm x 60 cm Standar Medis 45 GSM',
        package_volume = '1 Pack = 100 Lembar',
        batch_no = 'LOT-2607-D',
        expiry_date = DATE_ADD(CURDATE(), INTERVAL 400 DAY)
      WHERE code = 'BMHP-004' AND (specification IS NULL OR specification = '')
    `);

    await pool.query(`
      UPDATE bmhp_items SET 
        category = 'Desinfektan & Pembersih',
        item_type = 'Enzymatic Detergent',
        specification = 'Cairan Pembersih Multi-Enzim Netral pH',
        package_volume = '1 Galon = 5 Liter',
        batch_no = 'LOT-2606-E',
        expiry_date = DATE_ADD(CURDATE(), INTERVAL 240 DAY)
      WHERE code = 'BMHP-005' AND (specification IS NULL OR specification = '')
    `);
  } catch (err) {
    console.error('ensureBmhpColumns notice:', err.message);
  }
}

async function ensureItemUnitsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_units (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(50) NOT NULL,
        category ENUM('Semua', 'Steril', 'DTT') NOT NULL DEFAULT 'Semua',
        description VARCHAR(255) DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_item_units_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Pastikan kolom category ada jika tabel sudah ada sebelumnya
    const [cols] = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'item_units' AND column_name = 'category'"
    );
    if (!cols.length) {
      await pool.query("ALTER TABLE item_units ADD COLUMN category ENUM('Semua', 'Steril', 'DTT') NOT NULL DEFAULT 'Semua' AFTER name");
    }

    const defaults = [
      ['SET', 'Set', 'Semua', 'Set instrumen bedah/tindakan lengkap'],
      ['PCS', 'Pcs', 'Semua', 'Alat satuan / lepasan per pcs'],
      ['BUAH', 'Buah', 'Semua', 'Alat satuan per buah'],
      ['TABUNG', 'Tabung', 'DTT', 'Instrumen berbentuk tabung / kanul suction / trocar DTT'],
      ['SUNGKUP', 'Sungkup', 'DTT', 'Sungkup anestesi / resusitasi / nebulizer DTT'],
      ['PASANG', 'Pasang', 'Steril', 'Alat / sarung tangan bedah berpasangan'],
      ['LEMBAR', 'Lembar', 'Steril', 'Duk, kain linen, wrap steril'],
      ['ROL', 'Rol', 'Steril', 'Kasa rol dan pita indikator'],
      ['PAKET', 'Paket', 'Semua', 'Paket gabungan alat atau linen'],
      ['POUCH', 'Pouch', 'Steril', 'Kemasan steril pouch'],
    ];

    for (const [code, name, category, description] of defaults) {
      await pool.query(
        'INSERT INTO item_units (code, name, category, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), description = VALUES(description)',
        [code, name, category, description]
      );
    }
  } catch (err) {
    console.error('ensureItemUnitsTable notice:', err.message);
  }
}

async function ensureDttTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dtt_receipts (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        barcode VARCHAR(50) NOT NULL,
        receipt_datetime DATETIME NOT NULL,
        unit_id INT UNSIGNED NOT NULL,
        item_code VARCHAR(50) DEFAULT NULL,
        item_name VARCHAR(150) NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        unit_label VARCHAR(30) NOT NULL DEFAULT 'pcs',
        reuse_count INT UNSIGNED NOT NULL DEFAULT 1,
        max_reuse_limit INT UNSIGNED NOT NULL DEFAULT 10,
        tool_condition ENUM('Baik', 'Perlu Perbaikan', 'Rusak / Afkir') NOT NULL DEFAULT 'Baik',
        sender_name VARCHAR(100) NOT NULL,
        sender_signature TEXT DEFAULT NULL,
        receiver_name VARCHAR(100) NOT NULL,
        receiver_signature TEXT DEFAULT NULL,
        process_stage ENUM('Diterima', 'Pencucian DTT', 'Penyimpanan DTT', 'Siap Distribusi', 'Selesai') NOT NULL DEFAULT 'Diterima',
        dtt_method VARCHAR(100) DEFAULT 'DTT Manual (Perendaman Enzimatik & Disinfektan)',
        dtt_liquid VARCHAR(100) DEFAULT 'Glutaraldehyde 2%',
        dtt_duration_min INT UNSIGNED DEFAULT 20,
        verification_result ENUM('Belum Diverifikasi', 'Lolos', 'Gagal / Cuci Ulang') NOT NULL DEFAULT 'Belum Diverifikasi',
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_dtt_receipts_barcode (barcode),
        KEY idx_dtt_receipts_unit (unit_id),
        KEY idx_dtt_receipts_stage (process_stage)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dtt_distributions (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        barcode VARCHAR(50) NOT NULL,
        dtt_receipt_id INT UNSIGNED NOT NULL,
        dist_datetime DATETIME NOT NULL,
        unit_id INT UNSIGNED NOT NULL,
        item_name VARCHAR(150) NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        unit_label VARCHAR(30) NOT NULL DEFAULT 'pcs',
        reuse_count INT UNSIGNED NOT NULL DEFAULT 1,
        tool_condition ENUM('Baik', 'Perlu Perbaikan', 'Rusak / Afkir') NOT NULL DEFAULT 'Baik',
        officer VARCHAR(100) NOT NULL,
        officer_signature TEXT DEFAULT NULL,
        receiver_name VARCHAR(100) NOT NULL,
        receiver_signature TEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_dtt_dist_barcode (barcode),
        KEY idx_dtt_dist_unit (unit_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err) {
    console.error('ensureDttTables notice:', err.message);
  }
}

async function ensureAppSchemaUpdates() {
  try {
    const addCol = async (table, colDef) => {
      try {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (err) {
        if (err.errno !== 1060 && !err.message.includes('Duplicate column name')) {
          // ignore duplicate
        }
      }
    };

    await addCol('users', 'unit_id INT UNSIGNED DEFAULT NULL');
    try {
      await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','petugas','unit') NOT NULL DEFAULT 'petugas'");
    } catch (err) {}

    await addCol('distributions', 'gauze_type VARCHAR(100) DEFAULT NULL');
    await addCol('distributions', 'receiver_signature TEXT DEFAULT NULL');
    await addCol('distributions', 'officer_signature TEXT DEFAULT NULL');

    await addCol('items', "process_type ENUM('Steril','DTT') NOT NULL DEFAULT 'Steril'");
    await addCol('items', "unit_label VARCHAR(50) NOT NULL DEFAULT 'Set'");

    // Pastikan 5 preset mesin standar tersedia
    const presets = [
      { code: 'AU1', name: 'Autoclave 1', type: 'Autoclave 1' },
      { code: 'AU2', name: 'Autoclave 2', type: 'Autoclave 2' },
      { code: 'ST1', name: 'Steam Sterilizer', type: 'Steam Sterilizer' },
      { code: 'PL1', name: 'Plasma Sterilizer', type: 'Plasma Sterilizer' },
      { code: 'DT1', name: 'DTT Manual', type: 'DTT Manual' },
    ];
    for (const m of presets) {
      try {
        await pool.query(
          'INSERT INTO machines (code, name, type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type)',
          [m.code, m.name, m.type]
        );
      } catch (err) {}
    }
  } catch (err) {
    console.error('ensureAppSchemaUpdates notice:', err.message);
  }
}

async function start() {
  try {
    await pool.query('SELECT 1');
    await ensureAdmin();
    await ensureOfficersTable();
    await ensureInstrumentSetsTable();
    await ensureDiscrepancyTable();
    await ensureCategoryMigration();
    await ensurePackagingMaterialsTable();
    await ensureMachineTypeMigration();
    await ensureBmhpColumns();
    await ensureItemUnitsTable();
    await ensureDttTables();
    await ensureAppSchemaUpdates();
  } catch (err) {
    console.error('Gagal terhubung ke database. Pastikan MySQL berjalan dan sql/database.sql sudah diimport.');
    console.error(err.message);
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`CSSD SMART API berjalan di http://localhost:${PORT}/api`));
}

if (require.main === module) start();

module.exports = app;
