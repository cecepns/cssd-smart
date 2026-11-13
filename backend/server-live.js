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
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
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
const JWT_SECRET = env.JWT_SECRET || 'cssd-smart-jwt-secret-2026-production';
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || '12h';
const UPLOAD_FOLDER = env.UPLOAD_DIR || 'uploads-cssd-smart';
const UPLOAD_DIR = path.join(__dirname, UPLOAD_FOLDER);
const DEFAULT_SHELF_LIFE_MONTHS = Number(env.DEFAULT_SHELF_LIFE_MONTHS) || 6;
const ALLOWED_LIMITS = [10, 25, 50, 100];
const DEFAULT_LIMIT = 10;
const EXPORT_MAX_ROWS = 10000;

// if (!JWT_SECRET) {
//   console.error('JWT_SECRET wajib diisi pada file .env untuk mode production.');
//   process.exit(1);
// }

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
  host: "localhost",
  user: "kinq6231_cssd-smart",
  password: "kinq6231_cssd-smart",
  database: "kinq6231_cssd-smart",
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
const nowDateTimeStr = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  const hh = map.hour === '24' ? '00' : map.hour;
  return `${map.year}-${map.month}-${map.day} ${hh}:${map.minute}:${map.second}`;
};
const parseTzMs = (dtStr) => {
  if (!dtStr) return NaN;
  const s = String(dtStr).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return Date.parse(`${s.replace(' ', 'T')}${s.length === 16 ? ':00' : ''}+07:00`);
  }
  return Date.parse(s);
};
const diffSeconds = (fromDt, toDt) => {
  const a = parseTzMs(fromDt);
  const b = parseTzMs(toDt);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 1000));
};
const formatDurationSec = (sec) => {
  if (sec === null || sec === undefined || Number.isNaN(Number(sec))) return '-';
  const total = Math.max(0, Math.round(Number(sec)));
  if (total < 60) return `${total} dtk`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return s > 0 ? `${m} mnt ${s} dtk` : `${m} mnt`;
  }
  if (total < 86400) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`;
  }
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  return h > 0 ? `${d} hr ${h} jam` : `${d} hr`;
};
function resolveActionTimestamps(body) {
  const completedDate = new Date();
  let startedDate = completedDate;
  const rawStart = body?.started_at || body?._started_at;
  if (rawStart) {
    const rawStr = String(rawStart).trim();
    const ms = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(rawStr) ? parseTzMs(rawStr) : Date.parse(rawStr);
    if (!Number.isNaN(ms)) {
      const diffMs = completedDate.getTime() - ms;
      if (diffMs >= 0 && diffMs <= 12 * 3600 * 1000) {
        startedDate = new Date(ms);
      }
    }
  }
  return {
    started_at: nowDateTimeStr(startedDate),
    completed_at: nowDateTimeStr(completedDate),
  };
}
function enrichTimingRow(row) {
  if (!row || typeof row !== 'object') return row;
  if (row.started_at !== undefined || row.completed_at !== undefined) {
    row.started_time = row.started_at ? String(row.started_at).slice(11, 19) : '-';
    row.completed_time = row.completed_at ? String(row.completed_at).slice(11, 19) : (row.storage_active ? 'Masih Disimpan' : '-');
  }
  if (row.storage_active && row.started_at && !row.completed_at) {
    row.process_seconds = diffSeconds(row.started_at, nowDateTimeStr());
  } else if (row.process_seconds === undefined && row.started_at && row.completed_at) {
    row.process_seconds = diffSeconds(row.started_at, row.completed_at);
  }
  if (row.process_seconds !== undefined && row.process_seconds !== null) {
    row.process_duration = formatDurationSec(row.process_seconds);
  }
  if (row.wait_seconds !== undefined && row.wait_seconds !== null) {
    row.wait_duration = formatDurationSec(row.wait_seconds);
  } else if ('wait_seconds' in row) {
    row.wait_duration = '-';
  }
  return row;
}
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
  if (user?.role === 'unit') {
    if (cfg.unitColumn) {
      if (user.unit_id) {
        where.push(`${cfg.unitColumn} = ?`);
        params.push(user.unit_id);
      } else {
        where.push('1 = 0');
      }
    } else if (cfg.unitOrNullColumn) {
      if (user.unit_id) {
        where.push(`(${cfg.unitOrNullColumn} = ? OR ${cfg.unitOrNullColumn} IS NULL)`);
        params.push(user.unit_id);
      } else {
        where.push('1 = 0');
      }
    }
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

  if (cfg.timeColumn) {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(query.time_from || '')) {
      const tf = query.time_from.length === 5 ? `${query.time_from}:00` : query.time_from;
      where.push(`${cfg.timeColumn} >= ?`);
      params.push(tf);
    }
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(query.time_to || '')) {
      const tt = query.time_to.length === 5 ? `${query.time_to}:59` : query.time_to;
      where.push(`${cfg.timeColumn} <= ?`);
      params.push(tt);
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
  return { rows: rows.map(enrichTimingRow), total, page, limit };
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
  return rows[0] ? enrichTimingRow(rows[0]) : null;
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
  const roles = { read: ROLES, write: ['admin', 'petugas'], remove: ['admin', 'petugas'], export: ['admin'], ...(raw.roles || {}) };
  const base = `/${cfg.path}`;

  router.get(base, auth, allow(...roles.read), wrap(async (req, res) => {
    const { rows, total, page, limit } = await runList(cfg, req.query, { user: req.user });
    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  }));

  router.get(`${base}/export`, auth, allow(...roles.export), wrap(async (req, res) => {
    const { rows } = await runList(cfg, req.query, { all: true, user: req.user });
    const columns = cfg.exportColumns || Object.keys(rows[0] || {}).map((k) => [k, k]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cfg.path}-${todayStr()}.csv"`);
    res.send(toCsv(rows, columns));
  }));

  router.get(`${base}/:id(\\d+)`, auth, allow(...roles.read), wrap(async (req, res) => {
    const row = await fetchOne(cfg, parseId(req.params.id));
    if (!row) throw new HttpError(404, 'Data tidak ditemukan');
    if (req.user.role === 'unit') {
      if (cfg.unitColumn) {
        if (!req.user.unit_id || Number(row.unit_id) !== Number(req.user.unit_id)) {
          throw new HttpError(403, 'Anda tidak memiliki akses ke data unit lain');
        }
      } else if (cfg.unitOrNullColumn) {
        const rowUnitId = row.origin_unit_id ?? row.unit_id;
        if (!req.user.unit_id || (rowUnitId && Number(rowUnitId) !== Number(req.user.unit_id))) {
          throw new HttpError(403, 'Anda tidak memiliki akses ke data unit lain');
        }
      }
    }
    res.json({ success: true, data: row });
  }));

  if (cfg.readOnly) return;

  const fields = cfg.fields || [];
  const updatable = fields.filter((f) => !f.createOnly);

  if (!cfg.noCreate) {
    router.post(base, auth, allow(...roles.write), wrap(async (req, res) => {
      const bodyInput = req.body && typeof req.body === 'object' ? { ...req.body } : {};
      if (req.user.role === 'unit' && cfg.unitColumn) {
        if (!req.user.unit_id) throw new HttpError(403, 'Akun unit tidak terhubung ke unit rumah sakit');
        bodyInput.unit_id = req.user.unit_id;
      }
      const data = validate(fields, bodyInput);
      const ctx = { body: bodyInput, user: req.user };
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
    router.put(`${base}/:id(\\d+)`, auth, allow(...roles.write), wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const data = validate(updatable, req.body, { partial: true });
      const ctx = { body: req.body || {}, user: req.user };
      await withTx(async (conn) => {
        const [[existing]] = await conn.query('SELECT * FROM ?? WHERE id = ? FOR UPDATE', [cfg.table, id]);
        if (!existing) throw new HttpError(404, 'Data tidak ditemukan');
        if (req.user.role === 'unit' && cfg.unitColumn) {
          if (!req.user.unit_id || Number(existing.unit_id) !== Number(req.user.unit_id)) {
            throw new HttpError(403, 'Anda tidak memiliki akses untuk mengubah data unit lain');
          }
          if (data.unit_id !== undefined) data.unit_id = req.user.unit_id;
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
    router.delete(`${base}/:id(\\d+)`, auth, allow(...roles.remove), wrap(async (req, res) => {
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

async function recordAdminNotification(connOrNull, payload) {
  try {
    const q = connOrNull || pool;
    const {
      type,
      title,
      unit_id,
      unit_name,
      item_name,
      quantity = 1,
      unit_label = 'set',
      barcode,
      officer_sender,
      officer_receiver,
      signature_sender,
      signature_receiver,
      trx_date,
      trx_time,
      ref_table,
      ref_id,
      data_payload,
    } = payload;

    let resolvedUnitName = unit_name;
    if (!resolvedUnitName && unit_id) {
      const [[u]] = await q.query('SELECT name FROM units WHERE id = ?', [unit_id]);
      if (u) resolvedUnitName = u.name;
    }

    const jsonPayload = typeof data_payload === 'string' ? data_payload : JSON.stringify(data_payload || {});

    await q.query(`
      INSERT INTO activity_notifications
      (type, title, unit_id, unit_name, item_name, quantity, unit_label, barcode,
       officer_sender, officer_receiver, signature_sender, signature_receiver,
       trx_date, trx_time, ref_table, ref_id, data_payload, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      type,
      title,
      unit_id || null,
      resolvedUnitName || null,
      item_name || null,
      quantity,
      unit_label || 'set',
      barcode || null,
      officer_sender || null,
      officer_receiver || null,
      signature_sender || null,
      signature_receiver || null,
      trx_date || todayStr(),
      trx_time || nowDateTimeStr().slice(11, 16),
      ref_table,
      ref_id,
      jsonPayload,
    ]);
  } catch (err) {
    console.error('recordAdminNotification error (non-fatal):', err.message);
  }
}

/* ============================================================
 * RESOURCES
 * ============================================================ */
const MASTER_ROLES = { read: ['admin'], write: ['admin'], remove: ['admin'], export: ['admin'] };

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
  roles: MASTER_ROLES,
  fields: [
    field('name', 'string', { required: true, label: 'Nama', max: 100 }),
    field('username', 'string', { required: true, label: 'Username', min: 3, max: 50, createOnly: true }),
    field('password', 'string', { required: true, label: 'Password', min: 6, max: 72 }),
    field('role', 'enum', { values: ROLES, default: 'petugas', label: 'Role' }),
    field('unit_id', 'int', { label: 'Unit', min: 1 }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
  async beforeCreate(conn, data) {
    if (data.role === 'unit' && !data.unit_id) {
      throw new HttpError(422, 'Unit rumah sakit wajib dipilih untuk akun dengan Role Unit Luar', { unit_id: 'Unit wajib dipilih' });
    }
    if (data.role !== 'unit') data.unit_id = null;
    data.password = await bcrypt.hash(data.password, 10);
  },
  async beforeUpdate(conn, data, ctx, existing) {
    const targetRole = data.role || existing.role;
    const targetUnitId = data.unit_id !== undefined ? data.unit_id : existing.unit_id;
    if (targetRole === 'unit' && !targetUnitId) {
      throw new HttpError(422, 'Unit rumah sakit wajib dipilih untuk akun dengan Role Unit Luar', { unit_id: 'Unit wajib dipilih' });
    }
    if (data.role && data.role !== 'unit') data.unit_id = null;
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
  from: 'items t LEFT JOIN units u ON u.id = t.unit_id',
  select: 't.*, u.name AS unit_name, u.code AS unit_code',
  search: ['t.code', 't.name', 't.description', 't.unit_label', 't.process_type', 'u.name', 'u.code'],
  sort: { id: 't.id', code: 't.code', name: 't.name', unit_name: 'u.name', process_type: 't.process_type', category: 't.category', unit_label: 't.unit_label', created_at: 't.created_at' },
  defaultSort: 'id',
  filters: { unit_id: 't.unit_id', process_type: 't.process_type', category: 't.category', is_active: 't.is_active' },
  exportColumns: [['code', 'Kode'], ['name', 'Nama'], ['unit_name', 'Unit Asal'], ['process_type', 'Kategori Proses'], ['category', 'Kategori Kemasan'], ['unit_label', 'Satuan Standar'], ['shelf_life_months', 'Masa Steril (bulan)'], ['is_active', 'Aktif']],
  roles: MASTER_ROLES,
  fields: [
    field('unit_id', 'int', { required: true, min: 1, label: 'Unit asal' }),
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
  roles: MASTER_ROLES,
  fields: [
    field('code', 'string', { required: true, label: 'Kode', max: 20 }),
    field('name', 'string', { required: true, label: 'Nama Satuan', max: 50 }),
    field('category', 'enum', { values: ['Semua', 'Steril', 'DTT'], default: 'Semua', label: 'Kategori Penggunaan' }),
    field('description', 'string', { label: 'Keterangan', max: 255 }),
    field('is_active', 'bool', { default: 1, label: 'Aktif' }),
  ],
});

// ---------- Operational Lookups (read-only dropdown untuk form transaksi tanpa akses Master Data) ----------
router.get('/lookups/units', auth, wrap(async (req, res) => {
  const order = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const sortCol = req.query.sort_by === 'id' ? 'id' : 'name';
  if (req.user.role === 'unit') {
    if (!req.user.unit_id) return res.json({ success: true, data: [] });
    const [rows] = await pool.query(
      'SELECT id, code, name FROM units WHERE id = ? AND is_active = 1 LIMIT 1',
      [req.user.unit_id]
    );
    return res.json({ success: true, data: rows });
  }
  const [rows] = await pool.query(
    `SELECT id, code, name FROM units WHERE is_active = 1 ORDER BY ${sortCol} ${order} LIMIT 100`
  );
  res.json({ success: true, data: rows });
}));

router.get('/lookups/items', auth, wrap(async (req, res) => {
  const order = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const sortCol = req.query.sort_by === 'id' ? 't.id' : 't.name';
  const where = ['t.is_active = 1'];
  const params = [];
  if (req.query.process_type && ['Steril', 'DTT'].includes(req.query.process_type)) {
    where.push('t.process_type = ?');
    params.push(req.query.process_type);
  }
  if (req.user.role === 'unit') {
    if (!req.user.unit_id) return res.json({ success: true, data: [] });
    where.push('t.unit_id = ?');
    params.push(req.user.unit_id);
  } else if (req.query.unit_id !== undefined && req.query.unit_id !== '') {
    const uid = Number(req.query.unit_id);
    if (!Number.isInteger(uid) || uid < 1) return res.json({ success: true, data: [] });
    where.push('t.unit_id = ?');
    params.push(uid);
  } else if (req.query.require_unit === '1') {
    return res.json({ success: true, data: [] });
  }
  const [rows] = await pool.query(
    `SELECT t.id, t.unit_id, u.name AS unit_name, t.code, t.name, t.process_type, t.category, t.unit_label
     FROM items t
     LEFT JOIN units u ON u.id = t.unit_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${sortCol} ${order}
     LIMIT 100`,
    params
  );
  res.json({ success: true, data: rows });
}));

router.get('/lookups/officers', auth, wrap(async (req, res) => {
  const order = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const sortCol = req.query.sort_by === 'id' ? 'id' : 'name';
  const selectCols = req.user.role === 'unit'
    ? 'id, name, role, signature'
    : 'id, nip, name, role, signature';
  const [rows] = await pool.query(
    `SELECT ${selectCols} FROM officers WHERE is_active = 1 ORDER BY ${sortCol} ${order} LIMIT 100`
  );
  res.json({ success: true, data: rows });
}));

router.get('/lookups/machines', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const order = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const sortCol = req.query.sort_by === 'id' ? 'id' : 'name';
  const [rows] = await pool.query(
    `SELECT id, code, name, type FROM machines WHERE is_active = 1 ORDER BY ${sortCol} ${order} LIMIT 100`
  );
  res.json({ success: true, data: rows });
}));

router.get('/lookups/packaging-materials', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const order = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const sortCol = req.query.sort_by === 'id' ? 'id' : 'name';
  const [rows] = await pool.query(
    `SELECT id, code, name FROM packaging_materials WHERE is_active = 1 ORDER BY ${sortCol} ${order} LIMIT 100`
  );
  res.json({ success: true, data: rows });
}));

// ---------- Tahap 1: Alat Kotor Masuk (barcode) ----------
registerCrud({
  path: 'dirty-receipts',
  table: 'dirty_receipts',
  from: 'dirty_receipts t LEFT JOIN units u ON u.id = t.unit_id',
  select: `t.*, u.name AS unit_name, u.code AS unit_code,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0) AS process_seconds,
    0 AS wait_seconds`,
  search: ['t.barcode', 't.item_name', 'u.name', 't.sender_name', 't.receiver_name'],
  sort: { id: 't.id', barcode: 't.barcode', receipt_date: 't.receipt_date', started_at: 't.started_at', item_name: 't.item_name', quantity: 't.quantity', unit_name: 'u.name', status: 't.status', stage: 't.stage' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { unit_id: 't.unit_id', status: 't.status', stage: 't.stage', barcode: 't.barcode' },
  dateColumn: 't.receipt_date',
  timeColumn: 'TIME(COALESCE(t.started_at, t.created_at))',
  exportColumns: [
    ['barcode', 'Barcode'], ['receipt_date', 'Tanggal'], ['started_time', 'Jam Mulai'], ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'], ['wait_duration', 'Waktu Tunggu'], ['unit_name', 'Unit Asal'], ['item_name', 'Jenis Alat'],
    ['quantity', 'Jumlah'], ['unit_label', 'Satuan'], ['sender_name', 'Petugas Penyerah'], ['receiver_name', 'Petugas Penerima'],
    ['stage', 'Tahap'], ['status', 'Status'],
  ],
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
    field('receiver_name', 'string', { label: 'Petugas penerima', max: 100 }),
    field('receiver_signature', 'path', { label: 'TTD penerima' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;
    data.barcode = data.barcode || (await makeCode(conn, 'AK', data.receipt_date));
    data.stage = 1;
    data.status = 'Diterima';
    data.created_by = ctx.user.id;

    if (ctx.user.role === 'unit') {
      data.unit_id = ctx.user.unit_id || data.unit_id;
      data.receiver_name = data.receiver_name || 'Menunggu Konfirmasi CSSD';
      data.confirmed_at = null;
      data.confirmed_by = null;
    } else {
      data.receiver_name = data.receiver_name || ctx.user.name;
      data.confirmed_at = nowDateTimeStr();
      data.confirmed_by = ctx.user.name;
    }
  },
  async afterCreate(conn, id, data, ctx) {
    const [[fresh]] = await conn.query(
      'SELECT r.*, u.name AS unit_name FROM dirty_receipts r LEFT JOIN units u ON u.id = r.unit_id WHERE r.id = ?',
      [id]
    );
    if (fresh) {
      await recordAdminNotification(conn, {
        type: 'RECEIPT',
        title: 'Penerimaan Alat Kotor Masuk',
        unit_id: fresh.unit_id,
        unit_name: fresh.unit_name,
        item_name: fresh.item_name,
        quantity: fresh.quantity,
        unit_label: fresh.unit_label,
        barcode: fresh.barcode,
        officer_sender: fresh.sender_name,
        officer_receiver: fresh.receiver_name,
        signature_sender: fresh.sender_signature,
        signature_receiver: fresh.receiver_signature,
        trx_date: fresh.receipt_date,
        trx_time: (fresh.started_at || fresh.created_at || '').toString().slice(11, 16) || null,
        ref_table: 'dirty_receipts',
        ref_id: id,
        data_payload: fresh,
      });
    }
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
  select: `t.*, r.barcode AS receipt_barcode, r.item_name, r.unit_id, u.name AS unit_name,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0) AS process_seconds,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(r.completed_at, r.created_at), COALESCE(t.started_at, t.created_at)), 0) AS wait_seconds`,
  search: ['r.barcode', 'r.item_name', 'u.name', 't.officer', 't.liquid'],
  sort: { id: 't.id', wash_date: 't.wash_date', started_at: 't.started_at', receipt_barcode: 'r.barcode', item_name: 'r.item_name', unit_name: 'u.name', method: 't.method', officer: 't.officer' },
  defaultSort: 'id',
  filters: { method: 't.method', receipt_id: 't.receipt_id', unit_id: 'r.unit_id' },
  dateColumn: 't.wash_date',
  timeColumn: 'TIME(COALESCE(t.started_at, t.created_at))',
  exportColumns: [
    ['wash_date', 'Tanggal'], ['started_time', 'Jam Mulai'], ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'], ['wait_duration', 'Waktu Tunggu'], ['receipt_barcode', 'Barcode Alat Kotor'],
    ['item_name', 'Jenis Alat'], ['unit_name', 'Unit Asal'], ['method', 'Metode'], ['liquid', 'Cairan'],
    ['duration_min', 'Durasi Mesin (menit)'], ['officer', 'Petugas'],
  ],
  roles: { read: ['admin'], write: ['admin'], remove: ['admin'] },
  fields: [
    field('receipt_id', 'int', { required: true, min: 1, label: 'Alat kotor', createOnly: true }),
    field('method', 'enum', { values: ['Washer', 'Manual', 'Ultrasonik'], default: 'Washer', label: 'Metode' }),
    field('liquid', 'string', { label: 'Cairan', max: 100 }),
    field('duration_min', 'int', { min: 1, max: 600, label: 'Waktu (menit)' }),
    field('officer', 'string', { required: true, label: 'Petugas', max: 100 }),
    field('wash_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    const receipt = await getReceipt(conn, data.receipt_id);
    if (receipt.stage > 3 || receipt.status === 'Selesai') throw new HttpError(409, 'Alat sudah melewati tahap pencucian');
    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;
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
  select: `t.*, r.barcode AS receipt_barcode, r.item_name, r.unit_id, u.name AS unit_name,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0) AS process_seconds,
    (SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(w.completed_at, w.created_at), COALESCE(t.started_at, t.created_at)), 0)
     FROM washings w WHERE w.receipt_id = t.receipt_id ORDER BY w.id DESC LIMIT 1) AS wait_seconds`,
  search: ['r.barcode', 'r.item_name', 'u.name', 't.officer'],
  sort: { id: 't.id', dry_date: 't.dry_date', started_at: 't.started_at', receipt_barcode: 'r.barcode', item_name: 'r.item_name', unit_name: 'u.name', officer: 't.officer' },
  defaultSort: 'id',
  filters: { receipt_id: 't.receipt_id', unit_id: 'r.unit_id', is_dry: 't.is_dry', no_rust: 't.no_rust', function_ok: 't.function_ok' },
  dateColumn: 't.dry_date',
  timeColumn: 'TIME(COALESCE(t.started_at, t.created_at))',
  exportColumns: [
    ['dry_date', 'Tanggal'], ['started_time', 'Jam Mulai'], ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'], ['wait_duration', 'Waktu Tunggu'], ['receipt_barcode', 'Barcode Alat Kotor'],
    ['item_name', 'Jenis Alat'], ['unit_name', 'Unit Asal'], ['is_dry', 'Kering Sempurna'],
    ['no_rust', 'Tidak Berkarat'], ['function_ok', 'Fungsi Baik'], ['officer', 'Petugas'],
  ],
  roles: { read: ['admin'], write: ['admin'], remove: ['admin'] },
  fields: [
    field('receipt_id', 'int', { required: true, min: 1, label: 'Alat kotor', createOnly: true }),
    field('is_dry', 'bool', { default: 0, label: 'Alat kering sempurna' }),
    field('no_rust', 'bool', { default: 0, label: 'Tidak ada karat / noda' }),
    field('function_ok', 'bool', { default: 0, label: 'Fungsi alat baik' }),
    field('officer', 'string', { required: true, label: 'Petugas', max: 100 }),
    field('dry_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('notes', 'string', { label: 'Catatan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    const receipt = await getReceipt(conn, data.receipt_id);
    if (receipt.stage < 2) throw new HttpError(409, 'Alat belum melalui tahap pencucian');
    if (receipt.stage > 3 || receipt.status === 'Selesai') throw new HttpError(409, 'Alat sudah melewati tahap pengeringan');
    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;
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
  select: `t.*, r.barcode AS receipt_barcode, r.item_name, r.unit_id, u.name AS unit_name,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0) AS process_seconds,
    (SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(d.completed_at, d.created_at), COALESCE(t.started_at, t.created_at)), 0)
     FROM dryings d WHERE d.receipt_id = t.receipt_id AND d.is_dry = 1 AND d.no_rust = 1 AND d.function_ok = 1 ORDER BY d.id DESC LIMIT 1) AS wait_seconds`,
  search: ['t.barcode', 'r.barcode', 'r.item_name', 'u.name', 't.material', 't.officer'],
  sort: { id: 't.id', pack_date: 't.pack_date', started_at: 't.started_at', barcode: 't.barcode', item_name: 'r.item_name', unit_name: 'u.name', package_type: 't.package_type', quantity: 't.quantity', status: 't.status' },
  defaultSort: 'id',
  filters: { package_type: 't.package_type', status: 't.status', receipt_id: 't.receipt_id', unit_id: 'r.unit_id', barcode: 't.barcode' },
  dateColumn: 't.pack_date',
  timeColumn: 'TIME(COALESCE(t.started_at, t.created_at))',
  exportColumns: [
    ['pack_date', 'Tanggal'], ['started_time', 'Jam Mulai'], ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'], ['wait_duration', 'Waktu Tunggu'], ['barcode', 'Label Barcode'],
    ['receipt_barcode', 'Barcode Alat Kotor'], ['unit_name', 'Unit Asal'], ['item_name', 'Jenis Alat'],
    ['package_type', 'Jenis Kemasan'], ['material', 'Bahan Kemasan'], ['quantity', 'Jumlah'],
    ['unit_label', 'Satuan'], ['officer', 'Petugas'], ['status', 'Status'],
  ],
  roles: { read: ['admin'], write: ['admin'], remove: ['admin'] },
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
  async beforeCreate(conn, data, ctx) {
    const receipt = await getReceipt(conn, data.receipt_id);
    if (receipt.stage < 3) throw new HttpError(409, 'Alat belum selesai tahap pengeringan & pemeriksaan');
    if (receipt.stage > 5 || receipt.status === 'Selesai') throw new HttpError(409, 'Alat sudah selesai diproses');
    const [ok] = await conn.query('SELECT id FROM dryings WHERE receipt_id = ? AND is_dry = 1 AND no_rust = 1 AND function_ok = 1 LIMIT 1', [receipt.id]);
    if (!ok.length) throw new HttpError(409, 'Pemeriksaan pengeringan belum lolos');
    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;
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
  select: `t.*, m.name AS machine_name, m.code AS machine_code,
    (SELECT COUNT(*) FROM sterilization_items si WHERE si.sterilization_id = t.id) AS total_packages,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0) AS process_seconds,
    (SELECT GREATEST(TIMESTAMPDIFF(SECOND, MAX(COALESCE(p.completed_at, p.created_at)), COALESCE(t.started_at, t.created_at)), 0)
     FROM sterilization_items si JOIN packagings p ON p.id = si.packaging_id WHERE si.sterilization_id = t.id) AS wait_seconds`,
  search: ['t.batch_no', 't.cycle_no', 'm.name', 't.officer'],
  sort: { id: 't.id', steril_date: 't.steril_date', started_at: 't.started_at', batch_no: 't.batch_no', cycle_no: 't.cycle_no', machine_name: 'm.name', status: 't.status' },
  defaultSort: 'id',
  filters: { machine_id: 't.machine_id', status: 't.status' },
  dateColumn: 't.steril_date',
  timeColumn: 'TIME(COALESCE(t.started_at, t.created_at))',
  exportColumns: [
    ['steril_date', 'Tanggal'], ['started_time', 'Jam Mulai'], ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'], ['wait_duration', 'Waktu Tunggu'], ['machine_name', 'Mesin'],
    ['cycle_no', 'No. Siklus'], ['batch_no', 'No. Batch'], ['temperature', 'Suhu (C)'],
    ['duration_min', 'Durasi Siklus (menit)'], ['total_packages', 'Jumlah Paket'], ['officer', 'Petugas'], ['status', 'Status'],
  ],
  roles: { read: ['admin'], write: ['admin'], remove: ['admin'] },
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

    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;
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
  select: `t.*, s.batch_no, s.cycle_no, m.name AS machine_name,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0) AS process_seconds,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(s.completed_at, s.created_at), COALESCE(t.started_at, t.created_at)), 0) AS wait_seconds`,
  search: ['s.batch_no', 's.cycle_no', 't.officer', 'm.name'],
  sort: { id: 't.id', verify_date: 't.verify_date', started_at: 't.started_at', batch_no: 's.batch_no', result: 't.result', officer: 't.officer' },
  defaultSort: 'id',
  filters: { result: 't.result', sterilization_id: 't.sterilization_id' },
  dateColumn: 't.verify_date',
  timeColumn: 'TIME(COALESCE(t.started_at, t.created_at))',
  exportColumns: [
    ['verify_date', 'Tanggal'], ['started_time', 'Jam Mulai'], ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'], ['wait_duration', 'Waktu Tunggu'], ['batch_no', 'No. Batch'],
    ['machine_name', 'Mesin'], ['condition_packaging', 'Kondisi Kemasan'], ['chem_internal', 'Indikator Kimia Internal'],
    ['chem_external', 'Indikator Kimia Eksternal'], ['bio_indicator', 'Indikator Biologi'], ['bowie_dick', 'Bowie-Dick Test'],
    ['result', 'Hasil'], ['fail_reason', 'Alasan Gagal'], ['officer', 'Petugas'],
  ],
  roles: { read: ['admin'], write: ['admin'], remove: ['admin'] },
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

    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;

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
      const storageStartedAt = nowDateTimeStr();
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
          started_at: storageStartedAt,
          completed_at: null,
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
          const storageStartedAt = nowDateTimeStr();
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
              started_at: storageStartedAt,
              completed_at: null,
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

  if (req.user.role === 'unit') {
    if (!req.user.unit_id || (stock.origin_unit_id && Number(stock.origin_unit_id) !== Number(req.user.unit_id))) {
      throw new HttpError(403, 'Anda tidak memiliki akses ke stok milik unit lain');
    }
  }

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

  if (req.user.role === 'unit') {
    if (!req.user.unit_id) return res.json({ success: true, data: [] });
    sql += ' AND (r.unit_id = ? OR r.unit_id IS NULL)';
    params.push(req.user.unit_id);
  } else if (unit_id) {
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
  unitOrNullColumn: 'r.unit_id',
  roles: { read: ['admin', 'petugas', 'unit'] },
  from: `sterile_stock t
    LEFT JOIN packagings p ON p.id = t.packaging_id
    LEFT JOIN dirty_receipts r ON r.id = p.receipt_id
    LEFT JOIN units u ON u.id = r.unit_id
    LEFT JOIN instrument_sets s ON (s.name = t.item_name OR s.code = t.item_name)`,
  select: `t.*,
    ${STOCK_STATUS_SQL} AS display_status,
    DATEDIFF(t.expiry_date, CURDATE()) AS days_left,
    (CASE WHEN t.completed_at IS NULL AND t.status = 'Tersedia' THEN 1 ELSE 0 END) AS storage_active,
    (CASE WHEN t.completed_at IS NULL AND t.status = 'Tersedia' THEN NULL
          ELSE GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)
     END) AS process_seconds,
    (SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(v.completed_at, v.created_at), COALESCE(t.started_at, t.created_at)), 0)
     FROM verifications v
     JOIN sterilization_items si ON si.sterilization_id = v.sterilization_id
     WHERE si.packaging_id = t.packaging_id
     ORDER BY v.id DESC LIMIT 1) AS wait_seconds,
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
  sort: { id: 't.id', barcode: 't.barcode', item_name: 't.item_name', category: 't.category', batch_no: 't.batch_no', sterile_date: 't.sterile_date', started_at: 't.started_at', expiry_date: 't.expiry_date', quantity: 't.quantity' },
  defaultSort: 'id',
  filters: { category: 't.category', status: STOCK_STATUS_SQL, barcode: 't.barcode', batch_no: 't.batch_no', origin_unit_id: 'r.unit_id' },
  dateColumn: 't.sterile_date',
  timeColumn: 'TIME(COALESCE(t.started_at, t.created_at))',
  exportColumns: [
    ['item_name', 'Nama Alat'], ['category', 'Kategori'], ['origin_unit_name', 'Unit Asal'], ['barcode', 'Barcode'],
    ['batch_no', 'Batch'], ['sterile_date', 'Tgl Steril'], ['started_time', 'Jam Masuk Simpan'], ['completed_time', 'Jam Diambil'],
    ['process_duration', 'Lama Simpan'], ['wait_duration', 'Waktu Tunggu'], ['expiry_date', 'Tgl Kedaluwarsa'],
    ['quantity', 'Jumlah'], ['unit_label', 'Satuan'], ['display_status', 'Status'],
  ],
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
  roles: { read: ['admin'], write: ['admin'], remove: ['admin'] },
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
  select: `t.*, s.item_name, s.category, s.batch_no, s.unit_label, u.name AS unit_name,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0) AS process_seconds,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(s.started_at, s.created_at), COALESCE(t.started_at, t.created_at)), 0) AS wait_seconds`,
  search: ['t.barcode', 's.item_name', 't.gauze_type', 'u.name', 't.officer', 't.receiver_name'],
  sort: { id: 't.id', dist_date: 't.dist_date', started_at: 't.started_at', barcode: 't.barcode', item_name: 's.item_name', unit_name: 'u.name', quantity: 't.quantity' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { type: 't.type', unit_id: 't.unit_id', gauze_type: 't.gauze_type', barcode: 't.barcode' },
  dateColumn: 't.dist_date',
  timeColumn: 'TIME(COALESCE(t.started_at, t.created_at))',
  exportColumns: [
    ['dist_date', 'Tanggal'], ['started_time', 'Jam Mulai'], ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'], ['wait_duration', 'Waktu Tunggu'], ['type', 'Jenis'],
    ['barcode', 'Barcode'], ['item_name', 'Nama'], ['gauze_type', 'Jenis Kasa'], ['batch_no', 'Batch'],
    ['unit_name', 'Unit Tujuan'], ['quantity', 'Jumlah'], ['officer', 'Petugas CSSD'], ['receiver_name', 'Penerima Unit'],
  ],
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
    const [[otherDists]] = await conn.query('SELECT COUNT(*) AS cnt FROM distributions WHERE stock_id = ? AND id != ?', [existing.stock_id, existing.id]);
    // Kembalikan jumlah stok yang sudah didistribusikan ke sterile_stock
    await conn.query(
      `UPDATE sterile_stock SET quantity = quantity + ?, status = 'Tersedia'${otherDists.cnt === 0 ? ', completed_at = NULL' : ''} WHERE id = ?`,
      [existing.quantity, existing.stock_id]
    );
    // Jika packaging berstatus 'Terdistribusi', kembalikan ke 'Lulus'
    const [[stk]] = await conn.query('SELECT packaging_id FROM sterile_stock WHERE id = ?', [existing.stock_id]);
    if (stk?.packaging_id) {
      await conn.query("UPDATE packagings SET status = 'Lulus' WHERE id = ?", [stk.packaging_id]);
    }
  },
  async beforeUpdate(conn, data, ctx, existing) {
    if (ctx.user.role === 'unit') {
      if (!ctx.user.unit_id) throw new HttpError(403, 'Akun unit tidak terhubung ke unit rumah sakit');
      data.unit_id = ctx.user.unit_id;
    }
    if (data.barcode !== undefined && data.barcode !== existing.barcode) {
      throw new HttpError(422, 'Barcode distribusi tidak dapat diubah', { barcode: 'Barcode tidak dapat diubah' });
    }
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
    if (ctx.user.role === 'unit') {
      if (!ctx.user.unit_id) throw new HttpError(403, 'Akun unit tidak terhubung ke unit rumah sakit');
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
    if (ctx.user.role === 'unit' && stock.origin_unit_id && Number(stock.origin_unit_id) !== Number(ctx.user.unit_id)) {
      throw new HttpError(403, 'Anda tidak dapat mengambil stok milik unit lain', { barcode: 'Stok milik unit lain' });
    }
    if (stock.status !== 'Tersedia' || stock.quantity < 1) throw new HttpError(409, 'Stok untuk barcode ini sudah habis', { barcode: 'Stok sudah habis' });
    if (stock.expiry_date < todayStr()) throw new HttpError(409, 'Alat sudah kedaluwarsa dan tidak boleh didistribusikan', { barcode: 'Alat kedaluwarsa' });
    const isGauze = stock.category === 'Kasa Steril';
    if (data.type === 'KASA' && !isGauze) throw new HttpError(422, 'Barcode ini bukan kasa steril, gunakan menu Distribusi Alat Steril', { barcode: 'Bukan kasa steril' });
    if (data.type === 'ALAT' && isGauze) throw new HttpError(422, 'Barcode ini adalah kasa steril, gunakan menu Distribusi Kasa Steril', { barcode: 'Ini kasa steril' });
    if (data.quantity > stock.quantity) throw new HttpError(422, `Jumlah melebihi stok tersedia (${stock.quantity})`, { quantity: `Maksimal ${stock.quantity}` });

    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;
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
      "UPDATE sterile_stock SET quantity = quantity - ?, status = IF(quantity <= 0, 'Terdistribusi', status), completed_at = COALESCE(completed_at, ?) WHERE id = ?",
      [data.quantity, data.started_at, ctx.stock.id]
    );
    if (ctx.stock.quantity - data.quantity <= 0) {
      await conn.query("UPDATE packagings SET status = 'Terdistribusi' WHERE id = ?", [ctx.stock.packaging_id]);
    }
    const [[fresh]] = await conn.query(
      `SELECT d.*, u.name AS unit_name, st.item_name AS stock_item_name, st.unit_label AS stock_unit_label
       FROM distributions d
       LEFT JOIN units u ON u.id = d.unit_id
       LEFT JOIN sterile_stock st ON st.id = d.stock_id
       WHERE d.id = ?`,
      [id]
    );
    if (fresh) {
      const itemTitle = fresh.gauze_type || fresh.stock_item_name || 'Alat Steril';
      await recordAdminNotification(conn, {
        type: 'DISTRIBUTION',
        title: fresh.type === 'KASA' ? 'Distribusi Kasa Steril' : 'Pengambilan Alat Steril',
        unit_id: fresh.unit_id,
        unit_name: fresh.unit_name,
        item_name: itemTitle,
        quantity: fresh.quantity,
        unit_label: fresh.stock_unit_label || 'set',
        barcode: fresh.barcode,
        officer_sender: fresh.officer,
        officer_receiver: fresh.receiver_name,
        signature_sender: fresh.officer_signature,
        signature_receiver: fresh.receiver_signature,
        trx_date: fresh.dist_date,
        trx_time: (fresh.started_at || fresh.created_at || '').toString().slice(11, 16) || null,
        ref_table: 'distributions',
        ref_id: id,
        data_payload: fresh,
      });
    }
  },
});

// ---------- DTT (Reuse) Alat Siap Distribusi ----------
router.get('/dtt-receipts/ready', auth, wrap(async (req, res) => {
  let where = "WHERE t.process_stage IN ('Siap Distribusi', 'Penyimpanan DTT', 'Pencucian DTT', 'Diterima')";
  const params = [];
  if (req.user.role === 'unit') {
    if (!req.user.unit_id) return res.json({ success: true, data: [] });
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

// ---------- DTT (Reuse) Transaksi 1: Penerimaan Alat Kotor DTT/Reuse (Unit -> CSSD) ----------
registerCrud({
  path: 'dtt-receipts',
  table: 'dtt_receipts',
  from: 'dtt_receipts t JOIN units u ON u.id = t.unit_id',
  select: `t.*, u.name AS unit_name, u.code AS unit_code,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.receipt_datetime, t.created_at), COALESCE(t.completed_at, t.receipt_datetime, t.created_at)), 0) AS process_seconds,
    0 AS wait_seconds`,
  search: ['t.barcode', 't.item_name', 't.item_code', 'u.name', 't.sender_name', 't.receiver_name'],
  sort: { id: 't.id', barcode: 't.barcode', receipt_datetime: 't.receipt_datetime', started_at: 't.started_at', item_name: 't.item_name', unit_name: 'u.name', reuse_count: 't.reuse_count', tool_condition: 't.tool_condition', process_stage: 't.process_stage' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { unit_id: 't.unit_id', tool_condition: 't.tool_condition', process_stage: 't.process_stage', verification_result: 't.verification_result', barcode: 't.barcode' },
  dateColumn: 'DATE(t.receipt_datetime)',
  timeColumn: 'TIME(COALESCE(t.started_at, t.receipt_datetime, t.created_at))',
  exportColumns: [
    ['barcode', 'Barcode DTT'],
    ['receipt_datetime', 'Waktu Penerimaan'],
    ['started_time', 'Jam Mulai'],
    ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'],
    ['wait_duration', 'Waktu Tunggu'],
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
    field('receipt_datetime', 'datetime', { default: () => nowDateTimeStr(), label: 'Waktu Penerimaan' }),
    field('unit_id', 'int', { required: true, min: 1, label: 'Unit pengirim' }),
    field('item_code', 'string', { label: 'Kode alat', max: 50 }),
    field('item_name', 'string', { required: true, label: 'Nama alat DTT / Reuse', max: 150 }),
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
    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;
    if (!data.receipt_datetime) data.receipt_datetime = ts.completed_at;
    const today = (data.receipt_datetime || todayStr()).slice(0, 10);
    data.barcode = data.barcode || (await makeCode(conn, 'RD', today));
  },
  async afterCreate(conn, id, data, ctx) {
    const [[fresh]] = await conn.query(
      'SELECT r.*, u.name AS unit_name FROM dtt_receipts r LEFT JOIN units u ON u.id = r.unit_id WHERE r.id = ?',
      [id]
    );
    if (fresh) {
      await recordAdminNotification(conn, {
        type: 'DTT_RECEIPT',
        title: 'Penerimaan Alat Kotor DTT (Reuse)',
        unit_id: fresh.unit_id,
        unit_name: fresh.unit_name,
        item_name: fresh.item_name,
        quantity: fresh.quantity,
        unit_label: fresh.unit_label,
        barcode: fresh.barcode,
        officer_sender: fresh.sender_name,
        officer_receiver: fresh.receiver_name,
        signature_sender: fresh.sender_signature,
        signature_receiver: fresh.receiver_signature,
        trx_date: (fresh.receipt_datetime || '').toString().slice(0, 10),
        trx_time: (fresh.receipt_datetime || '').toString().slice(11, 16),
        ref_table: 'dtt_receipts',
        ref_id: id,
        data_payload: fresh,
      });
    }
  },
});

// ---------- DTT (Reuse) Transaksi 2: Distribusi Alat Hasil DTT (CSSD -> Unit) ----------
registerCrud({
  path: 'dtt-distributions',
  table: 'dtt_distributions',
  from: 'dtt_distributions t JOIN units u ON u.id = t.unit_id JOIN dtt_receipts r ON r.id = t.dtt_receipt_id',
  select: `t.*, u.name AS unit_name, r.barcode AS receipt_barcode,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.dist_datetime, t.created_at), COALESCE(t.completed_at, t.dist_datetime, t.created_at)), 0) AS process_seconds,
    GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(r.completed_at, r.receipt_datetime, r.created_at), COALESCE(t.started_at, t.dist_datetime, t.created_at)), 0) AS wait_seconds`,
  search: ['t.barcode', 't.item_name', 'u.name', 't.officer', 't.receiver_name', 'r.barcode'],
  sort: { id: 't.id', dist_datetime: 't.dist_datetime', started_at: 't.started_at', barcode: 't.barcode', item_name: 't.item_name', unit_name: 'u.name' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { unit_id: 't.unit_id', tool_condition: 't.tool_condition', barcode: 't.barcode' },
  dateColumn: 'DATE(t.dist_datetime)',
  timeColumn: 'TIME(COALESCE(t.started_at, t.dist_datetime, t.created_at))',
  exportColumns: [
    ['barcode', 'Barcode Distribusi'],
    ['dist_datetime', 'Waktu Distribusi'],
    ['started_time', 'Jam Mulai'],
    ['completed_time', 'Jam Selesai'],
    ['process_duration', 'Lama Proses'],
    ['wait_duration', 'Waktu Tunggu'],
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
    field('dist_datetime', 'datetime', { default: () => nowDateTimeStr(), label: 'Waktu Distribusi' }),
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
    if (ctx.user.role === 'unit') {
      if (!ctx.user.unit_id) throw new HttpError(403, 'Akun unit tidak terhubung ke unit rumah sakit');
      data.unit_id = ctx.user.unit_id;
    }
    const [[dttReceipt]] = await conn.query('SELECT * FROM dtt_receipts WHERE id = ? FOR UPDATE', [data.dtt_receipt_id]);
    if (!dttReceipt) throw new HttpError(404, 'Data penerimaan DTT tidak ditemukan', { dtt_receipt_id: 'Data DTT tidak ditemukan' });
    if (ctx.user.role === 'unit' && Number(dttReceipt.unit_id) !== Number(ctx.user.unit_id)) {
      throw new HttpError(403, 'Anda tidak memiliki akses ke alat DTT unit lain');
    }
    const ts = resolveActionTimestamps(ctx.body);
    data.started_at = ts.started_at;
    data.completed_at = ts.completed_at;
    if (!data.dist_datetime) data.dist_datetime = ts.completed_at;
    const today = (data.dist_datetime || todayStr()).slice(0, 10);
    data.barcode = data.barcode || (await makeCode(conn, 'DDTT', today));
    await conn.query("UPDATE dtt_receipts SET process_stage = 'Selesai' WHERE id = ?", [data.dtt_receipt_id]);
  },
  async afterCreate(conn, id, data, ctx) {
    const [[fresh]] = await conn.query(
      'SELECT d.*, u.name AS unit_name FROM dtt_distributions d LEFT JOIN units u ON u.id = d.unit_id WHERE d.id = ?',
      [id]
    );
    if (fresh) {
      await recordAdminNotification(conn, {
        type: 'DTT_DISTRIBUTION',
        title: 'Distribusi Alat Hasil DTT (Reuse)',
        unit_id: fresh.unit_id,
        unit_name: fresh.unit_name,
        item_name: fresh.item_name,
        quantity: fresh.quantity,
        unit_label: fresh.unit_label,
        barcode: fresh.barcode,
        officer_sender: fresh.officer,
        officer_receiver: fresh.receiver_name,
        signature_sender: fresh.officer_signature,
        signature_receiver: fresh.receiver_signature,
        trx_date: (fresh.dist_datetime || '').toString().slice(0, 10),
        trx_time: (fresh.dist_datetime || '').toString().slice(11, 16),
        ref_table: 'dtt_distributions',
        ref_id: id,
        data_payload: fresh,
      });
    }
  },
  async beforeUpdate(conn, data, ctx, existing) {
    if (ctx.user.role === 'unit') {
      if (!ctx.user.unit_id) throw new HttpError(403, 'Akun unit tidak terhubung ke unit rumah sakit');
      data.unit_id = ctx.user.unit_id;
    }
    if (data.dtt_receipt_id && Number(data.dtt_receipt_id) !== Number(existing.dtt_receipt_id)) {
      const [[dttReceipt]] = await conn.query('SELECT * FROM dtt_receipts WHERE id = ? FOR UPDATE', [data.dtt_receipt_id]);
      if (!dttReceipt) throw new HttpError(404, 'Data penerimaan DTT tidak ditemukan', { dtt_receipt_id: 'Data DTT tidak ditemukan' });
      if (ctx.user.role === 'unit' && Number(dttReceipt.unit_id) !== Number(ctx.user.unit_id)) {
        throw new HttpError(403, 'Anda tidak memiliki akses ke alat DTT unit lain');
      }
    }
  },
  async beforeDelete(conn, existing) {
    await conn.query("UPDATE dtt_receipts SET process_stage = 'Siap Distribusi' WHERE id = ?", [existing.dtt_receipt_id]);
  },
});

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
  roles: { read: ['admin', 'petugas'], write: ['admin'], remove: ['admin'] },
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
  async beforeUpdate(conn, data, ctx, existing) {
    if (data.initial_stock !== undefined && Number(data.initial_stock) !== Number(existing.initial_stock)) {
      const [[mut]] = await conn.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'MASUK' THEN quantity ELSE 0 END), 0) AS total_in,
          COALESCE(SUM(CASE WHEN type = 'KELUAR' THEN quantity ELSE 0 END), 0) AS total_out
        FROM bmhp_transactions WHERE bmhp_item_id = ?
      `, [existing.id]);
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
  roles: { read: ['admin', 'petugas'], write: ['admin', 'petugas'], remove: ['admin', 'petugas'] },
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
async function getInstrumentSetsWithStock(query = {}, user = null) {
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

  const isUnit = user?.role === 'unit';
  const unitId = user?.unit_id || null;

  let stockRows = [];
  let processRows = [];
  let distRows = [];
  let returnRows = [];
  let discRows = [];

  if (isUnit) {
    if (unitId) {
      [stockRows] = await pool.query(`
        SELECT 
          LOWER(TRIM(st.item_name)) AS norm_name,
          SUM(CASE WHEN st.status = 'Tersedia' AND st.expiry_date >= CURDATE() THEN st.quantity ELSE 0 END) AS available_qty
        FROM sterile_stock st
        LEFT JOIN packagings p ON p.id = st.packaging_id
        LEFT JOIN dirty_receipts r ON r.id = p.receipt_id
        WHERE (r.unit_id = ? OR r.unit_id IS NULL)
        GROUP BY LOWER(TRIM(st.item_name))
      `, [unitId]);

      [processRows] = await pool.query(`
        SELECT LOWER(TRIM(item_name)) AS norm_name, SUM(quantity) AS in_process_qty
        FROM dirty_receipts
        WHERE status IN ('Diterima', 'Proses') AND unit_id = ?
        GROUP BY LOWER(TRIM(item_name))
      `, [unitId]);

      [distRows] = await pool.query(`
        SELECT LOWER(TRIM(s.item_name)) AS norm_name, SUM(t.quantity) AS distributed_qty
        FROM distributions t
        JOIN sterile_stock s ON s.id = t.stock_id
        WHERE t.unit_id = ?
        GROUP BY LOWER(TRIM(s.item_name))
      `, [unitId]);

      [returnRows] = await pool.query(`
        SELECT LOWER(TRIM(item_name)) AS norm_name, SUM(quantity) AS returned_qty
        FROM dirty_receipts
        WHERE unit_id = ?
        GROUP BY LOWER(TRIM(item_name))
      `, [unitId]);
    }
  } else {
    // Hitung stok siap pakai (Tersedia) dari sterile_stock
    [stockRows] = await pool.query(`
      SELECT 
        LOWER(TRIM(item_name)) AS norm_name,
        SUM(CASE WHEN status = 'Tersedia' AND expiry_date >= CURDATE() THEN quantity ELSE 0 END) AS available_qty
      FROM sterile_stock
      GROUP BY LOWER(TRIM(item_name))
    `);

    // Hitung alat kotor yang sedang diproses (Diterima / Proses)
    [processRows] = await pool.query(`
      SELECT LOWER(TRIM(item_name)) AS norm_name, SUM(quantity) AS in_process_qty
      FROM dirty_receipts
      WHERE status IN ('Diterima', 'Proses')
      GROUP BY LOWER(TRIM(item_name))
    `);

    // Hitung alat yang sedang terdistribusi di unit
    [distRows] = await pool.query(`
      SELECT LOWER(TRIM(s.item_name)) AS norm_name, SUM(t.quantity) AS distributed_qty
      FROM distributions t
      JOIN sterile_stock s ON s.id = t.stock_id
      GROUP BY LOWER(TRIM(s.item_name))
    `);

    // Hitung alat kotor yang sudah dikembalikan oleh unit
    [returnRows] = await pool.query(`
      SELECT LOWER(TRIM(item_name)) AS norm_name, SUM(quantity) AS returned_qty
      FROM dirty_receipts
      GROUP BY LOWER(TRIM(item_name))
    `);

    // Riwayat insiden / discrepancy instrumen yang belum selesai
    [discRows] = await pool.query(`
      SELECT * FROM instrument_discrepancy_logs 
      WHERE resolution_status = 'Belum Selesai' 
      ORDER BY incident_date DESC
    `).catch(() => [[]]);
  }

  const stockMap = {};
  for (const row of stockRows) {
    stockMap[row.norm_name] = Number(row.available_qty) || 0;
  }

  const processMap = {};
  for (const row of processRows) {
    processMap[row.norm_name] = Number(row.in_process_qty) || 0;
  }

  const distMap = {};
  for (const row of distRows) {
    distMap[row.norm_name] = Number(row.distributed_qty) || 0;
  }

  const returnMap = {};
  for (const row of returnRows) {
    returnMap[row.norm_name] = Number(row.returned_qty) || 0;
  }

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
  const sets = await getInstrumentSetsWithStock(req.query, req.user);
  res.json({ success: true, data: sets });
}));

// GET /instrument-sets/movements (Monitoring mutasi & pergerakan pengambilan & pengembalian)
router.get('/instrument-sets/movements', auth, wrap(async (req, res) => {
  const query = req.query || {};
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = ALLOWED_LIMITS.includes(Number(query.limit)) ? Number(query.limit) : DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const typeFilter = query.type || null;

  const isUnit = req.user.role === 'unit';
  if (isUnit && !req.user.unit_id) {
    return res.json({
      success: true,
      data: [],
      pagination: { page, limit, total: 0, totalPages: 1 },
    });
  }
  const unitParams = isUnit ? [req.user.unit_id] : [];

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
      ${isUnit ? 'AND d.unit_id = ?' : ''}
  `, unitParams);

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
      ${isUnit ? 'AND dr.unit_id = ?' : ''}
  `, unitParams);

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
router.get('/instrument-sets/discrepancies', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
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
  const sets = await getInstrumentSetsWithStock({}, req.user);
  const set = sets.find((s) => s.id === id);
  if (!set) throw new HttpError(404, 'Set instrumen tidak ditemukan');
  res.json({ success: true, data: set });
}));

router.post('/instrument-sets', auth, allow('admin'), wrap(async (req, res) => {
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

router.put('/instrument-sets/:id', auth, allow('admin'), wrap(async (req, res) => {
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
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 30,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { success: false, message: 'Terlalu banyak percobaan login, coba lagi nanti' },
// });

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

router.post('/auth/login', wrap(async (req, res) => {
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
  if (data.role === 'unit' && !data.unit_id) {
    throw new HttpError(422, 'Unit rumah sakit wajib dipilih untuk akun dengan Role Unit Luar', { unit_id: 'Unit wajib dipilih' });
  }
  if (data.role !== 'unit') data.unit_id = null;
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
router.post('/auth/verify-report-access', auth, allow('admin'), wrap(async (req, res) => {
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
router.get('/reports/monthly-summary', auth, allow('admin'), wrap(async (req, res) => {
  const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();

  // 1. Rekap Steril Bulanan
  const [[sterilSummary]] = await pool.query(`
    SELECT
      COUNT(DISTINCT s.id) AS total_batches,
      COUNT(DISTINCT si.packaging_id) AS total_packages,
      COUNT(DISTINCT CASE WHEN v.result = 'LULUS' THEN v.id END) AS passed_verifications,
      COUNT(DISTINCT CASE WHEN v.result = 'GAGAL' THEN v.id END) AS failed_verifications
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

  // 2. Rekap DTT (Reuse) Bulanan
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
      (SELECT COUNT(*) FROM packagings WHERE MONTH(pack_date) = ? AND YEAR(pack_date) = ?) AS packagings_count,
      (SELECT COUNT(*) FROM sterilizations WHERE MONTH(steril_date) = ? AND YEAR(steril_date) = ?) AS steril_batches,
      (SELECT COALESCE(SUM(quantity), 0) FROM distributions WHERE (type = 'ALAT' AND (gauze_type IS NULL OR gauze_type = '')) AND MONTH(dist_date) = ? AND YEAR(dist_date) = ?) AS sterile_tools_distributed,
      (SELECT COALESCE(SUM(quantity), 0) FROM distributions WHERE (type = 'KASA' OR gauze_type IS NOT NULL) AND MONTH(dist_date) = ? AND YEAR(dist_date) = ?) AS gauze_distributed,
      (SELECT COUNT(*) FROM dtt_receipts WHERE MONTH(receipt_datetime) = ? AND YEAR(receipt_datetime) = ?) AS dtt_receipts,
      (SELECT COUNT(*) FROM dtt_distributions WHERE MONTH(dist_datetime) = ? AND YEAR(dist_datetime) = ?) AS dtt_distributions,
      (SELECT COALESCE(SUM(quantity), 0) FROM bmhp_transactions WHERE type = 'KELUAR' AND MONTH(trx_date) = ? AND YEAR(trx_date) = ?) AS bmhp_consumed,
      (SELECT COUNT(*) FROM quarantines WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?) AS quarantines_count
  `, [month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year]);

  // 5. Rekap Waktu Proses & Waktu Tunggu per Tahapan CSSD Bulanan
  const calcStageTiming = async (stageName, sql) => {
    const [[row]] = await pool.query(sql, [month, year]);
    const avgProc = row?.avg_process_seconds !== null && row?.avg_process_seconds !== undefined ? Math.round(Number(row.avg_process_seconds)) : null;
    const avgWait = row?.avg_wait_seconds !== null && row?.avg_wait_seconds !== undefined ? Math.round(Number(row.avg_wait_seconds)) : null;
    const totalProc = row?.total_process_seconds !== null && row?.total_process_seconds !== undefined ? Math.round(Number(row.total_process_seconds)) : 0;
    const totalWait = row?.total_wait_seconds !== null && row?.total_wait_seconds !== undefined ? Math.round(Number(row.total_wait_seconds)) : 0;
    return {
      stage: stageName,
      total_records: Number(row?.cnt || 0),
      avg_process_seconds: avgProc,
      avg_process_duration: formatDurationSec(avgProc),
      total_process_seconds: totalProc,
      total_process_duration: formatDurationSec(totalProc),
      avg_wait_seconds: avgWait,
      avg_wait_duration: formatDurationSec(avgWait),
      total_wait_seconds: totalWait,
      total_wait_duration: formatDurationSec(totalWait),
    };
  };

  const timings = await Promise.all([
    calcStageTiming('Alat Kotor Masuk', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS total_process_seconds,
        0 AS avg_wait_seconds,
        0 AS total_wait_seconds
      FROM dirty_receipts t
      WHERE MONTH(t.receipt_date) = ? AND YEAR(t.receipt_date) = ?
    `),
    calcStageTiming('Pencucian', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS total_process_seconds,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(r.completed_at, r.created_at), COALESCE(t.started_at, t.created_at)), 0)) AS avg_wait_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(r.completed_at, r.created_at), COALESCE(t.started_at, t.created_at)), 0)) AS total_wait_seconds
      FROM washings t
      JOIN dirty_receipts r ON r.id = t.receipt_id
      WHERE MONTH(t.wash_date) = ? AND YEAR(t.wash_date) = ?
    `),
    calcStageTiming('Pengeringan & Pemeriksaan', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS total_process_seconds,
        AVG((SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(w.completed_at, w.created_at), COALESCE(t.started_at, t.created_at)), 0)
             FROM washings w WHERE w.receipt_id = t.receipt_id ORDER BY w.id DESC LIMIT 1)) AS avg_wait_seconds,
        SUM((SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(w.completed_at, w.created_at), COALESCE(t.started_at, t.created_at)), 0)
             FROM washings w WHERE w.receipt_id = t.receipt_id ORDER BY w.id DESC LIMIT 1)) AS total_wait_seconds
      FROM dryings t
      WHERE MONTH(t.dry_date) = ? AND YEAR(t.dry_date) = ?
    `),
    calcStageTiming('Pengemasan', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS total_process_seconds,
        AVG((SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(d.completed_at, d.created_at), COALESCE(t.started_at, t.created_at)), 0)
             FROM dryings d WHERE d.receipt_id = t.receipt_id AND d.is_dry = 1 AND d.no_rust = 1 AND d.function_ok = 1 ORDER BY d.id DESC LIMIT 1)) AS avg_wait_seconds,
        SUM((SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(d.completed_at, d.created_at), COALESCE(t.started_at, t.created_at)), 0)
             FROM dryings d WHERE d.receipt_id = t.receipt_id AND d.is_dry = 1 AND d.no_rust = 1 AND d.function_ok = 1 ORDER BY d.id DESC LIMIT 1)) AS total_wait_seconds
      FROM packagings t
      WHERE MONTH(t.pack_date) = ? AND YEAR(t.pack_date) = ?
    `),
    calcStageTiming('Sterilisasi', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS total_process_seconds,
        AVG((SELECT GREATEST(TIMESTAMPDIFF(SECOND, MAX(COALESCE(p.completed_at, p.created_at)), COALESCE(t.started_at, t.created_at)), 0)
             FROM sterilization_items si JOIN packagings p ON p.id = si.packaging_id WHERE si.sterilization_id = t.id)) AS avg_wait_seconds,
        SUM((SELECT GREATEST(TIMESTAMPDIFF(SECOND, MAX(COALESCE(p.completed_at, p.created_at)), COALESCE(t.started_at, t.created_at)), 0)
             FROM sterilization_items si JOIN packagings p ON p.id = si.packaging_id WHERE si.sterilization_id = t.id)) AS total_wait_seconds
      FROM sterilizations t
      WHERE MONTH(t.steril_date) = ? AND YEAR(t.steril_date) = ?
    `),
    calcStageTiming('Verifikasi', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS total_process_seconds,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(s.completed_at, s.created_at), COALESCE(t.started_at, t.created_at)), 0)) AS avg_wait_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(s.completed_at, s.created_at), COALESCE(t.started_at, t.created_at)), 0)) AS total_wait_seconds
      FROM verifications t
      JOIN sterilizations s ON s.id = t.sterilization_id
      WHERE MONTH(t.verify_date) = ? AND YEAR(t.verify_date) = ?
    `),
    calcStageTiming('Penyimpanan Alat Steril', `
      SELECT COUNT(*) AS cnt,
        AVG(CASE WHEN t.completed_at IS NOT NULL THEN GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), t.completed_at), 0) ELSE NULL END) AS avg_process_seconds,
        SUM(CASE WHEN t.completed_at IS NOT NULL THEN GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), t.completed_at), 0) ELSE 0 END) AS total_process_seconds,
        AVG((SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(v.completed_at, v.created_at), COALESCE(t.started_at, t.created_at)), 0)
             FROM verifications v JOIN sterilization_items si ON si.sterilization_id = v.sterilization_id WHERE si.packaging_id = t.packaging_id ORDER BY v.id DESC LIMIT 1)) AS avg_wait_seconds,
        SUM((SELECT GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(v.completed_at, v.created_at), COALESCE(t.started_at, t.created_at)), 0)
             FROM verifications v JOIN sterilization_items si ON si.sterilization_id = v.sterilization_id WHERE si.packaging_id = t.packaging_id ORDER BY v.id DESC LIMIT 1)) AS total_wait_seconds
      FROM sterile_stock t
      WHERE MONTH(t.sterile_date) = ? AND YEAR(t.sterile_date) = ?
    `),
    calcStageTiming('Distribusi Alat / Kasa Steril', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.created_at), COALESCE(t.completed_at, t.created_at)), 0)) AS total_process_seconds,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(s.started_at, s.created_at), COALESCE(t.started_at, t.created_at)), 0)) AS avg_wait_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(s.started_at, s.created_at), COALESCE(t.started_at, t.created_at)), 0)) AS total_wait_seconds
      FROM distributions t
      JOIN sterile_stock s ON s.id = t.stock_id
      WHERE MONTH(t.dist_date) = ? AND YEAR(t.dist_date) = ?
    `),
    calcStageTiming('Penerimaan Alat DTT (Reuse)', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.receipt_datetime, t.created_at), COALESCE(t.completed_at, t.receipt_datetime, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.receipt_datetime, t.created_at), COALESCE(t.completed_at, t.receipt_datetime, t.created_at)), 0)) AS total_process_seconds,
        0 AS avg_wait_seconds,
        0 AS total_wait_seconds
      FROM dtt_receipts t
      WHERE MONTH(t.receipt_datetime) = ? AND YEAR(t.receipt_datetime) = ?
    `),
    calcStageTiming('Distribusi Alat DTT (Reuse)', `
      SELECT COUNT(*) AS cnt,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.dist_datetime, t.created_at), COALESCE(t.completed_at, t.dist_datetime, t.created_at)), 0)) AS avg_process_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(t.started_at, t.dist_datetime, t.created_at), COALESCE(t.completed_at, t.dist_datetime, t.created_at)), 0)) AS total_process_seconds,
        AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(r.completed_at, r.receipt_datetime, r.created_at), COALESCE(t.started_at, t.dist_datetime, t.created_at)), 0)) AS avg_wait_seconds,
        SUM(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(r.completed_at, r.receipt_datetime, r.created_at), COALESCE(t.started_at, t.dist_datetime, t.created_at)), 0)) AS total_wait_seconds
      FROM dtt_distributions t
      JOIN dtt_receipts r ON r.id = t.dtt_receipt_id
      WHERE MONTH(t.dist_datetime) = ? AND YEAR(t.dist_datetime) = ?
    `),
  ]);

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
      timings,
    },
  });
}));

// ---------- BMHP Ringkasan / Summary ----------
router.get('/bmhp-summary', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
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

  if (isUnit) {
    if (!unitId) {
      return res.json({
        success: true,
        data: {
          pipeline: {},
          totals: {
            received_today: 0,
            waiting_verification: 0,
            sterile_stock: 0,
            expired: 0,
            quarantine: 0,
            bmhp_low: 0,
            bmhp_empty: 0,
            bmhp_expired: 0,
            bmhp_expiring_soon: 0,
            distributed_today: 0,
            dtt_received_today: 0,
            dtt_distributed_today: 0,
            active_processes: 0,
            dtt_active: 0,
            today_transactions: 0,
          },
          expiring: [],
          lowBmhp: [],
          recentVerifications: [],
          recentQuarantines: [],
        },
      });
    }
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
    SELECT d.id, d.barcode, d.item_name, d.quantity, d.unit_label, d.receipt_datetime, d.process_stage, d.receiver_name AS officer_cssd
    FROM dtt_receipts d
    WHERE d.unit_id = ? AND d.process_stage IN ('Selesai Steril/DTT', 'Siap Distribusi', 'Selesai')
    AND d.id NOT IN (SELECT dtt_receipt_id FROM dtt_distributions WHERE unit_id = ?)
    ORDER BY d.id DESC LIMIT 50
  `, [unitId, unitId]);

  // 4. Riwayat transaksi terakhir unit
  const [recentReceipts] = await pool.query(`
    SELECT 'Penerimaan Alat Kotor' AS jenis, barcode, receipt_date AS tanggal, item_name, quantity, unit_label, receiver_name AS petugas
    FROM dirty_receipts WHERE unit_id = ? ORDER BY id DESC LIMIT 5
  `, [unitId]);

  const [recentDistributions] = await pool.query(`
    SELECT 'Pengambilan Alat Steril' AS jenis, st.barcode, d.dist_date AS tanggal, st.item_name, d.quantity, st.unit_label, d.receiver_name AS petugas
    FROM distributions d
    JOIN sterile_stock st ON st.id = d.stock_id
    WHERE d.unit_id = ? ORDER BY d.id DESC LIMIT 5
  `, [unitId]);

  const [recentDtt] = await pool.query(`
    SELECT 'Pengambilan Alat DTT' AS jenis, dd.barcode, dd.dist_datetime AS tanggal, dd.item_name, dd.quantity, dd.unit_label, dd.receiver_name AS petugas
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
function makeTimelineEvent({ order, stage, date, officer, detail, status = 'ok', startedAt, completedAt, waitFromAt, storageActive = false }) {
  const sAt = startedAt || (date ? `${String(date).slice(0, 10)} 00:00:00` : null);
  const cAt = storageActive ? null : (completedAt || sAt);
  const procSec = storageActive && sAt
    ? diffSeconds(sAt, nowDateTimeStr())
    : (sAt && cAt ? diffSeconds(sAt, cAt) : null);
  const waitSec = waitFromAt && sAt ? diffSeconds(waitFromAt, sAt) : 0;
  return {
    order,
    stage,
    date,
    officer,
    detail,
    status,
    started_at: sAt,
    completed_at: cAt,
    started_time: sAt ? String(sAt).slice(11, 19) : '-',
    completed_time: storageActive ? 'Masih Disimpan' : (cAt ? String(cAt).slice(11, 19) : '-'),
    storage_active: storageActive,
    process_seconds: procSec,
    process_duration: formatDurationSec(procSec),
    wait_seconds: waitSec,
    wait_duration: formatDurationSec(waitSec),
  };
}

function summarizeTimeline(timeline) {
  const sumProcess = timeline.reduce((acc, ev) => acc + (Number(ev.process_seconds) || 0), 0);
  const sumWait = timeline.reduce((acc, ev) => acc + (Number(ev.wait_seconds) || 0), 0);
  const starts = timeline.map((ev) => ev.started_at).filter(Boolean).sort();
  const ends = timeline.map((ev) => ev.completed_at).filter(Boolean).sort();
  const hasActiveStorage = timeline.some((ev) => ev.storage_active);
  const firstStart = starts[0] || null;
  const lastEnd = hasActiveStorage ? nowDateTimeStr() : (ends[ends.length - 1] || firstStart);
  const totalElapsed = firstStart && lastEnd ? diffSeconds(firstStart, lastEnd) : (sumProcess + sumWait);
  return {
    total_process_seconds: sumProcess,
    total_process_duration: formatDurationSec(sumProcess),
    total_wait_seconds: sumWait,
    total_wait_duration: formatDurationSec(sumWait),
    total_elapsed_seconds: totalElapsed,
    total_elapsed_duration: formatDurationSec(totalElapsed),
  };
}

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
            s.officer AS steril_officer, s.started_at AS steril_started_at, s.completed_at AS steril_completed_at,
            s.created_at AS steril_created_at, m.name AS machine_name,
            v.id AS verification_id, v.result, v.verify_date, v.officer AS verify_officer, v.fail_reason,
            v.started_at AS verify_started_at, v.completed_at AS verify_completed_at, v.created_at AS verify_created_at
     FROM packagings p
     LEFT JOIN sterilization_items si ON si.packaging_id = p.id
     LEFT JOIN sterilizations s ON s.id = si.sterilization_id
     LEFT JOIN machines m ON m.id = s.machine_id
     LEFT JOIN verifications v ON v.sterilization_id = s.id
     WHERE p.receipt_id = ? ORDER BY p.id, s.id`,
    [receiptId]
  );
  const [stocks] = await pool.query(
    `SELECT st.*,
       (SELECT COALESCE(v.completed_at, v.created_at)
        FROM verifications v
        JOIN sterilization_items si ON si.sterilization_id = v.sterilization_id
        WHERE si.packaging_id = st.packaging_id
        ORDER BY v.id DESC LIMIT 1) AS verify_completed_at
     FROM sterile_stock st
     JOIN packagings p ON p.id = st.packaging_id
     WHERE p.receipt_id = ? ORDER BY st.id`,
    [receiptId]
  );
  const [distributions] = await pool.query(
    `SELECT d.*, u.name AS unit_name, COALESCE(s.started_at, s.created_at) AS stock_started_at
     FROM distributions d
     JOIN sterile_stock s ON s.id = d.stock_id
     JOIN packagings p ON p.id = s.packaging_id
     JOIN units u ON u.id = d.unit_id
     WHERE p.receipt_id = ? ORDER BY d.id`,
    [receiptId]
  );

  const receiptStart = receipt.started_at || receipt.created_at;
  const receiptEnd = receipt.completed_at || receipt.created_at;

  const timeline = [
    makeTimelineEvent({
      order: 1,
      stage: 'Alat Kotor Masuk',
      date: receipt.receipt_date,
      officer: `${receipt.sender_name} → ${receipt.receiver_name}`,
      detail: `${receipt.item_name} (${receipt.quantity} ${receipt.unit_label}) dari ${receipt.unit_name || '-'}`,
      status: 'ok',
      startedAt: receiptStart,
      completedAt: receiptEnd,
      waitFromAt: null,
    }),
  ];

  let lastWashEnd = receiptEnd;
  washings.forEach((w) => {
    const wStart = w.started_at || w.created_at;
    const wEnd = w.completed_at || w.created_at;
    timeline.push(makeTimelineEvent({
      order: 2,
      stage: 'Pencucian',
      date: w.wash_date,
      officer: w.officer,
      detail: `${w.method}${w.liquid ? `, ${w.liquid}` : ''}${w.duration_min ? `, ${w.duration_min} menit` : ''}`,
      status: 'ok',
      startedAt: wStart,
      completedAt: wEnd,
      waitFromAt: receiptEnd,
    }));
    lastWashEnd = wEnd;
  });

  let lastDryEnd = lastWashEnd;
  dryings.forEach((d) => {
    const passed = Boolean(d.is_dry && d.no_rust && d.function_ok);
    const dStart = d.started_at || d.created_at;
    const dEnd = d.completed_at || d.created_at;
    timeline.push(makeTimelineEvent({
      order: 3,
      stage: 'Pengeringan & Pemeriksaan',
      date: d.dry_date,
      officer: d.officer,
      detail: passed ? 'Kering, tidak berkarat, fungsi baik' : 'Tidak lolos pemeriksaan, dicuci ulang',
      status: passed ? 'ok' : 'fail',
      startedAt: dStart,
      completedAt: dEnd,
      waitFromAt: lastWashEnd,
    }));
    if (passed) lastDryEnd = dEnd;
  });

  const seenPackages = new Set();
  const seenSterils = new Set();
  const seenVerifs = new Set();
  packages.forEach((p) => {
    const pStart = p.started_at || p.created_at;
    const pEnd = p.completed_at || p.created_at;
    if (!seenPackages.has(p.id)) {
      seenPackages.add(p.id);
      timeline.push(makeTimelineEvent({
        order: 4,
        stage: 'Pengemasan',
        date: p.pack_date,
        officer: p.officer,
        detail: `${p.barcode} — ${p.package_type}, ${p.material}, ${p.quantity} ${p.unit_label}`,
        status: 'ok',
        startedAt: pStart,
        completedAt: pEnd,
        waitFromAt: lastDryEnd,
      }));
    }
    const sStart = p.steril_started_at || p.steril_created_at;
    const sEnd = p.steril_completed_at || p.steril_created_at;
    if (p.sterilization_id && !seenSterils.has(`${p.id}-${p.sterilization_id}`)) {
      seenSterils.add(`${p.id}-${p.sterilization_id}`);
      timeline.push(makeTimelineEvent({
        order: 5,
        stage: 'Sterilisasi',
        date: p.steril_date,
        officer: p.steril_officer,
        detail: `${p.barcode} — ${p.machine_name}, siklus ${p.cycle_no}, batch ${p.batch_no}, ${p.temperature}°C ${p.duration_min} menit`,
        status: 'ok',
        startedAt: sStart,
        completedAt: sEnd,
        waitFromAt: pEnd,
      }));
    }
    if (p.result && !seenVerifs.has(`${p.id}-${p.verification_id || p.sterilization_id}`)) {
      seenVerifs.add(`${p.id}-${p.verification_id || p.sterilization_id}`);
      const vStart = p.verify_started_at || p.verify_created_at;
      const vEnd = p.verify_completed_at || p.verify_created_at;
      timeline.push(makeTimelineEvent({
        order: 6,
        stage: 'Verifikasi',
        date: p.verify_date,
        officer: p.verify_officer,
        detail: `${p.barcode} — ${p.result}${p.fail_reason ? `: ${p.fail_reason}` : ''}`,
        status: p.result === 'LULUS' ? 'ok' : 'fail',
        startedAt: vStart,
        completedAt: vEnd,
        waitFromAt: sEnd,
      }));
    }
  });

  stocks.forEach((st) => {
    const stStart = st.started_at || st.created_at;
    const isActive = !st.completed_at && st.status === 'Tersedia';
    timeline.push(makeTimelineEvent({
      order: 7,
      stage: 'Penyimpanan Alat Steril',
      date: st.sterile_date,
      officer: 'Sistem CSSD',
      detail: `${st.barcode} — Sisa stok: ${st.quantity} ${st.unit_label} (Exp: ${st.expiry_date}, Status: ${st.status})`,
      status: 'ok',
      startedAt: stStart,
      completedAt: st.completed_at,
      waitFromAt: st.verify_completed_at || stStart,
      storageActive: isActive,
    }));
  });

  distributions.forEach((d) => {
    const distStart = d.started_at || d.created_at;
    const distEnd = d.completed_at || d.created_at;
    timeline.push(makeTimelineEvent({
      order: 8,
      stage: d.type === 'KASA' ? 'Distribusi Kasa Steril' : 'Distribusi Alat Steril',
      date: d.dist_date,
      officer: d.receiver_name ? `${d.officer} → ${d.receiver_name}` : d.officer,
      detail: `${d.barcode} — ${d.quantity} ke ${d.unit_name}`,
      status: 'ok',
      startedAt: distStart,
      completedAt: distEnd,
      waitFromAt: d.stock_started_at,
    }));
  });

  timeline.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.order !== b.order) return a.order - b.order;
    return (a.started_at || '') < (b.started_at || '') ? -1 : 1;
  });

  const receiptWithTiming = enrichTimingRow({ ...receipt });
  return { receipt: receiptWithTiming, timeline, summary: summarizeTimeline(timeline) };
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

  const recDate = (receipt.receipt_datetime || '').slice(0, 10);
  const recStart = receipt.started_at || receipt.receipt_datetime || receipt.created_at;
  const recEnd = receipt.completed_at || receipt.receipt_datetime || receipt.created_at;

  const timeline = [
    makeTimelineEvent({
      order: 1,
      stage: 'Penerimaan Alat Kotor DTT (Reuse)',
      date: recDate,
      officer: `${receipt.sender_name} → ${receipt.receiver_name}`,
      detail: `${receipt.barcode} — ${receipt.item_name} (${receipt.quantity} ${receipt.unit_label}) • Pemakaian ke-${receipt.reuse_count} • Kondisi: ${receipt.tool_condition}`,
      status: 'ok',
      startedAt: recStart,
      completedAt: recEnd,
      waitFromAt: null,
    }),
    makeTimelineEvent({
      order: 2,
      stage: 'Pencucian & DTT',
      date: recDate,
      officer: receipt.receiver_name,
      detail: `${receipt.dtt_method} • Cairan: ${receipt.dtt_liquid} • Waktu: ${receipt.dtt_duration_min} menit`,
      status: 'ok',
      startedAt: recStart,
      completedAt: recEnd,
      waitFromAt: recEnd,
    }),
    makeTimelineEvent({
      order: 3,
      stage: 'Verifikasi & Penyimpanan DTT',
      date: recDate,
      officer: receipt.receiver_name,
      detail: `Hasil Verifikasi: ${receipt.verification_result} • Status: ${receipt.process_stage}`,
      status: receipt.verification_result === 'Gagal / Cuci Ulang' ? 'fail' : 'ok',
      startedAt: recEnd,
      completedAt: recEnd,
      waitFromAt: recEnd,
    }),
  ];

  distributions.forEach((d) => {
    const dStart = d.started_at || d.dist_datetime || d.created_at;
    const dEnd = d.completed_at || d.dist_datetime || d.created_at;
    timeline.push(makeTimelineEvent({
      order: 4,
      stage: 'Distribusi Alat Hasil DTT (Reuse)',
      date: (d.dist_datetime || '').slice(0, 10),
      officer: `${d.officer} → ${d.receiver_name}`,
      detail: `${d.barcode} — ${d.quantity} ${d.unit_label} ke ${d.unit_name} (Pemakaian ke-${d.reuse_count})`,
      status: 'ok',
      startedAt: dStart,
      completedAt: dEnd,
      waitFromAt: recEnd,
    }));
  });

  const receiptWithTiming = enrichTimingRow({
    ...receipt,
    receipt_date: recDate,
    is_dtt: true,
  });

  return {
    receipt: receiptWithTiming,
    timeline,
    summary: summarizeTimeline(timeline),
  };
}

router.get('/traceability', auth, wrap(async (req, res) => {
  const code = sanitizeText(req.query.barcode || '').slice(0, 50);
  const rawUnitId = req.user.role === 'unit' ? req.user.unit_id : (req.query.unit_id ? Number(req.query.unit_id) : null);
  const unitId = rawUnitId && Number.isInteger(Number(rawUnitId)) && Number(rawUnitId) > 0 ? Number(rawUnitId) : null;
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_from || '') ? req.query.date_from : '';
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_to || '') ? req.query.date_to : '';
  const timeFrom = /^\d{2}:\d{2}(:\d{2})?$/.test(req.query.time_from || '')
    ? (req.query.time_from.length === 5 ? `${req.query.time_from}:00` : req.query.time_from)
    : '';
  const timeTo = /^\d{2}:\d{2}(:\d{2})?$/.test(req.query.time_to || '')
    ? (req.query.time_to.length === 5 ? `${req.query.time_to}:59` : req.query.time_to)
    : '';
  const officer = sanitizeText(req.query.officer || '').slice(0, 100);

  const hasAnyFilter = Boolean(code || req.query.unit_id || dateFrom || dateTo || timeFrom || timeTo || officer);
  if (!hasAnyFilter) {
    throw new HttpError(422, 'Isi minimal satu filter pencarian (barcode, unit asal, tanggal, jam proses, atau petugas)');
  }

  if (req.user.role === 'unit' && !unitId) {
    return res.json({ success: true, data: [] });
  }

  // 1. Cek BMHP hanya jika mencari barcode exact tanpa filter unit/tanggal/petugas (khusus internal CSSD)
  if (code && !req.query.unit_id && !dateFrom && !dateTo && !timeFrom && !timeTo && !officer && req.user.role !== 'unit') {
    const [bmhpItem] = await pool.query('SELECT * FROM bmhp_items WHERE code = ? LIMIT 1', [code]);
    if (bmhpItem.length > 0) {
      const item = bmhpItem[0];
      const [txs] = await pool.query('SELECT * FROM bmhp_transactions WHERE bmhp_item_id = ? ORDER BY id DESC LIMIT 10', [item.id]);
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
              date: String(item.created_at || '').slice(0, 10),
              started_time: String(item.created_at || '').slice(11, 19) || '-',
              completed_time: String(item.created_at || '').slice(11, 19) || '-',
              process_duration: '0 dtk',
              wait_duration: '0 dtk',
              detail: `Stok saat ini: ${item.stock} ${item.unit_label} (Min: ${item.min_stock}). Batch: ${item.batch_no || '-'}, Exp: ${item.expiry_date || '-'}`,
              officer: 'Logistik CSSD',
            },
            ...txs.map((t) => ({
              stage: t.type === 'MASUK' ? 'Barang Masuk' : 'Barang Keluar',
              date: t.trx_date,
              started_time: String(t.created_at || '').slice(11, 19) || '-',
              completed_time: String(t.created_at || '').slice(11, 19) || '-',
              process_duration: '0 dtk',
              wait_duration: '0 dtk',
              detail: `${t.type === 'MASUK' ? '+' : '-'}${t.quantity} ${item.unit_label} • ${t.notes || '-'}`,
              officer: t.officer,
            })),
          ],
          summary: { total_process_duration: '0 dtk', total_wait_duration: '0 dtk', total_elapsed_duration: '0 dtk' },
        }],
      });
    }
  }

  // 2. Query Alur Steril (dirty_receipts) berdasarkan semua filter aktif
  const sterileWhere = ['1=1'];
  const sterileParams = [];

  if (unitId) {
    sterileWhere.push('r.unit_id = ?');
    sterileParams.push(unitId);
  }
  if (code) {
    const codeLike = `%${escapeLike(code)}%`;
    sterileWhere.push(`(
      r.barcode LIKE ?
      OR EXISTS (SELECT 1 FROM packagings p WHERE p.receipt_id = r.id AND p.barcode LIKE ?)
      OR EXISTS (
        SELECT 1 FROM distributions d
        JOIN sterile_stock s ON s.id = d.stock_id
        JOIN packagings p ON p.id = s.packaging_id
        WHERE p.receipt_id = r.id AND d.barcode LIKE ?
      )
      OR EXISTS (
        SELECT 1 FROM sterilizations st
        JOIN sterilization_items si ON si.sterilization_id = st.id
        JOIN packagings p ON p.id = si.packaging_id
        WHERE p.receipt_id = r.id AND st.batch_no LIKE ?
      )
    )`);
    sterileParams.push(codeLike, codeLike, codeLike, codeLike);
  }
  if (dateFrom) {
    sterileWhere.push(`(
      r.receipt_date >= ?
      OR EXISTS (SELECT 1 FROM washings w WHERE w.receipt_id = r.id AND w.wash_date >= ?)
      OR EXISTS (SELECT 1 FROM dryings d WHERE d.receipt_id = r.id AND d.dry_date >= ?)
      OR EXISTS (SELECT 1 FROM packagings p WHERE p.receipt_id = r.id AND p.pack_date >= ?)
      OR EXISTS (SELECT 1 FROM distributions di JOIN sterile_stock ss ON ss.id = di.stock_id JOIN packagings p ON p.id = ss.packaging_id WHERE p.receipt_id = r.id AND di.dist_date >= ?)
    )`);
    sterileParams.push(dateFrom, dateFrom, dateFrom, dateFrom, dateFrom);
  }
  if (dateTo) {
    sterileWhere.push(`(
      r.receipt_date <= ?
      OR EXISTS (SELECT 1 FROM washings w WHERE w.receipt_id = r.id AND w.wash_date <= ?)
      OR EXISTS (SELECT 1 FROM dryings d WHERE d.receipt_id = r.id AND d.dry_date <= ?)
      OR EXISTS (SELECT 1 FROM packagings p WHERE p.receipt_id = r.id AND p.pack_date <= ?)
      OR EXISTS (SELECT 1 FROM distributions di JOIN sterile_stock ss ON ss.id = di.stock_id JOIN packagings p ON p.id = ss.packaging_id WHERE p.receipt_id = r.id AND di.dist_date <= ?)
    )`);
    sterileParams.push(dateTo, dateTo, dateTo, dateTo, dateTo);
  }
  if (timeFrom || timeTo) {
    const makeTimeRangeSql = (expr) => {
      if (timeFrom && timeTo) {
        sterileParams.push(timeFrom, timeTo);
        return `(${expr} >= ? AND ${expr} <= ?)`;
      }
      if (timeFrom) {
        sterileParams.push(timeFrom);
        return `(${expr} >= ?)`;
      }
      sterileParams.push(timeTo);
      return `(${expr} <= ?)`;
    };
    const rCond = makeTimeRangeSql('TIME(COALESCE(r.started_at, r.created_at))');
    const wCond = makeTimeRangeSql('TIME(COALESCE(w.started_at, w.created_at))');
    const dCond = makeTimeRangeSql('TIME(COALESCE(d.started_at, d.created_at))');
    const pCond = makeTimeRangeSql('TIME(COALESCE(p.started_at, p.created_at))');
    const sCond = makeTimeRangeSql('TIME(COALESCE(st.started_at, st.created_at))');
    const vCond = makeTimeRangeSql('TIME(COALESCE(v.started_at, v.created_at))');
    const diCond = makeTimeRangeSql('TIME(COALESCE(di.started_at, di.created_at))');
    sterileWhere.push(`(
      ${rCond}
      OR EXISTS (SELECT 1 FROM washings w WHERE w.receipt_id = r.id AND ${wCond})
      OR EXISTS (SELECT 1 FROM dryings d WHERE d.receipt_id = r.id AND ${dCond})
      OR EXISTS (SELECT 1 FROM packagings p WHERE p.receipt_id = r.id AND ${pCond})
      OR EXISTS (SELECT 1 FROM sterilizations st JOIN sterilization_items si ON si.sterilization_id = st.id JOIN packagings p ON p.id = si.packaging_id WHERE p.receipt_id = r.id AND ${sCond})
      OR EXISTS (SELECT 1 FROM verifications v JOIN sterilization_items si ON si.sterilization_id = v.sterilization_id JOIN packagings p ON p.id = si.packaging_id WHERE p.receipt_id = r.id AND ${vCond})
      OR EXISTS (SELECT 1 FROM distributions di JOIN sterile_stock ss ON ss.id = di.stock_id JOIN packagings p ON p.id = ss.packaging_id WHERE p.receipt_id = r.id AND ${diCond})
    )`);
  }
  if (officer) {
    const offLike = `%${escapeLike(officer)}%`;
    sterileWhere.push(`(
      r.sender_name LIKE ? OR r.receiver_name LIKE ?
      OR EXISTS (SELECT 1 FROM washings w WHERE w.receipt_id = r.id AND w.officer LIKE ?)
      OR EXISTS (SELECT 1 FROM dryings d WHERE d.receipt_id = r.id AND d.officer LIKE ?)
      OR EXISTS (SELECT 1 FROM packagings p WHERE p.receipt_id = r.id AND p.officer LIKE ?)
      OR EXISTS (SELECT 1 FROM sterilizations st JOIN sterilization_items si ON si.sterilization_id = st.id JOIN packagings p ON p.id = si.packaging_id WHERE p.receipt_id = r.id AND st.officer LIKE ?)
      OR EXISTS (SELECT 1 FROM verifications v JOIN sterilization_items si ON si.sterilization_id = v.sterilization_id JOIN packagings p ON p.id = si.packaging_id WHERE p.receipt_id = r.id AND v.officer LIKE ?)
      OR EXISTS (SELECT 1 FROM distributions di JOIN sterile_stock ss ON ss.id = di.stock_id JOIN packagings p ON p.id = ss.packaging_id WHERE p.receipt_id = r.id AND (di.officer LIKE ? OR di.receiver_name LIKE ?))
    )`);
    sterileParams.push(offLike, offLike, offLike, offLike, offLike, offLike, offLike, offLike, offLike);
  }

  const [sterileRows] = await pool.query(
    `SELECT r.id FROM dirty_receipts r WHERE ${sterileWhere.join(' AND ')} ORDER BY r.id DESC LIMIT 20`,
    sterileParams
  );

  // 3. Query Alur DTT (Reuse)
  const dttWhere = ['1=1'];
  const dttParams = [];
  if (unitId) {
    dttWhere.push('dr.unit_id = ?');
    dttParams.push(unitId);
  }
  if (code) {
    const codeLike = `%${escapeLike(code)}%`;
    dttWhere.push('(dr.barcode LIKE ? OR EXISTS (SELECT 1 FROM dtt_distributions dd WHERE dd.dtt_receipt_id = dr.id AND dd.barcode LIKE ?))');
    dttParams.push(codeLike, codeLike);
  }
  if (dateFrom) {
    dttWhere.push('(DATE(dr.receipt_datetime) >= ? OR EXISTS (SELECT 1 FROM dtt_distributions dd WHERE dd.dtt_receipt_id = dr.id AND DATE(dd.dist_datetime) >= ?))');
    dttParams.push(dateFrom, dateFrom);
  }
  if (dateTo) {
    dttWhere.push('(DATE(dr.receipt_datetime) <= ? OR EXISTS (SELECT 1 FROM dtt_distributions dd WHERE dd.dtt_receipt_id = dr.id AND DATE(dd.dist_datetime) <= ?))');
    dttParams.push(dateTo, dateTo);
  }
  if (timeFrom || timeTo) {
    const makeDttTimeSql = (expr) => {
      if (timeFrom && timeTo) {
        dttParams.push(timeFrom, timeTo);
        return `(${expr} >= ? AND ${expr} <= ?)`;
      }
      if (timeFrom) {
        dttParams.push(timeFrom);
        return `(${expr} >= ?)`;
      }
      dttParams.push(timeTo);
      return `(${expr} <= ?)`;
    };
    const drCond = makeDttTimeSql('TIME(COALESCE(dr.started_at, dr.receipt_datetime, dr.created_at))');
    const ddCond = makeDttTimeSql('TIME(COALESCE(dd.started_at, dd.dist_datetime, dd.created_at))');
    dttWhere.push(`(${drCond} OR EXISTS (SELECT 1 FROM dtt_distributions dd WHERE dd.dtt_receipt_id = dr.id AND ${ddCond}))`);
  }
  if (officer) {
    const offLike = `%${escapeLike(officer)}%`;
    dttWhere.push('(dr.sender_name LIKE ? OR dr.receiver_name LIKE ? OR EXISTS (SELECT 1 FROM dtt_distributions dd WHERE dd.dtt_receipt_id = dr.id AND (dd.officer LIKE ? OR dd.receiver_name LIKE ?)))');
    dttParams.push(offLike, offLike, offLike, offLike);
  }

  const [dttRows] = await pool.query(
    `SELECT dr.id FROM dtt_receipts dr WHERE ${dttWhere.join(' AND ')} ORDER BY dr.id DESC LIMIT 20`,
    dttParams
  );

  const [sterileTraces, dttTraces] = await Promise.all([
    Promise.all(sterileRows.map((r) => buildTrace(r.id))),
    Promise.all(dttRows.map((r) => buildDttTrace(r.id))),
  ]);

  const traces = [...sterileTraces.filter(Boolean), ...dttTraces.filter(Boolean)]
    .sort((a, b) => {
      const ka = a.receipt.started_at || a.receipt.created_at || a.receipt.receipt_date || '';
      const kb = b.receipt.started_at || b.receipt.created_at || b.receipt.receipt_date || '';
      return kb < ka ? -1 : kb > ka ? 1 : 0;
    })
    .slice(0, 25);

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

// ---------- Notifikasi Aktivitas Admin CSSD ----------
router.get('/notifications', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const type = req.query.type ? sanitizeText(req.query.type) : null;
  const isRead = req.query.is_read !== undefined && req.query.is_read !== '' ? parseInt(req.query.is_read, 10) : null;

  const where = ['1=1'];
  const params = [];
  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  if (isRead !== null && !Number.isNaN(isRead)) {
    where.push('is_read = ?');
    params.push(isRead);
  }

  const [rows] = await pool.query(
    `SELECT * FROM activity_notifications WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`,
    [...params, limit]
  );

  const [[{ unread_count }]] = await pool.query(
    'SELECT COUNT(*) AS unread_count FROM activity_notifications WHERE is_read = 0'
  );

  res.json({
    success: true,
    data: rows,
    unread_count: Number(unread_count || 0),
  });
}));

router.post('/notifications/:id(\\d+)/read', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  await pool.query('UPDATE activity_notifications SET is_read = 1 WHERE id = ?', [id]);
  res.json({ success: true, message: 'Notifikasi ditandai sudah dibaca' });
}));

router.post('/notifications/mark-all-read', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  await pool.query('UPDATE activity_notifications SET is_read = 1 WHERE is_read = 0');
  res.json({ success: true, message: 'Semua notifikasi ditandai sudah dibaca' });
}));

// ---------- Pemantauan Log Waktu Pengerjaan Alat di CSSD (Request 2) ----------
router.get('/monitoring/process-timings', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const unitId = req.query.unit_id ? parseInt(req.query.unit_id, 10) : null;
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_from || '') ? req.query.date_from : '';
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_to || '') ? req.query.date_to : '';
  const status = req.query.status ? sanitizeText(req.query.status) : '';
  const search = (req.query.search || '').trim();
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const where = ['1=1'];
  const params = [];

  if (unitId) {
    where.push('r.unit_id = ?');
    params.push(unitId);
  }
  if (dateFrom) {
    where.push('r.receipt_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push('r.receipt_date <= ?');
    params.push(dateTo);
  }
  if (status) {
    where.push('r.status = ?');
    params.push(status);
  }
  if (search) {
    const q = `%${escapeLike(search)}%`;
    where.push('(r.barcode LIKE ? OR r.item_name LIKE ? OR u.name LIKE ? OR r.receiver_name LIKE ?)');
    params.push(q, q, q, q);
  }

  const [[{ total }]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM dirty_receipts r
    LEFT JOIN units u ON u.id = r.unit_id
    WHERE ${where.join(' AND ')}
  `, params);

  const [receipts] = await pool.query(`
    SELECT r.id
    FROM dirty_receipts r
    LEFT JOIN units u ON u.id = r.unit_id
    WHERE ${where.join(' AND ')}
    ORDER BY r.id DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const items = [];
  for (const r of receipts) {
    const trace = await buildTrace(r.id);
    if (!trace) continue;
    items.push({
      receipt: trace.receipt,
      timeline: trace.timeline,
      summary: trace.summary,
    });
  }

  const [[kpi]] = await pool.query(`
    SELECT
      COUNT(*) AS total_receipts,
      AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(w.started_at, w.created_at), COALESCE(w.completed_at, w.created_at)), 0)) AS avg_wash_sec,
      AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(st.started_at, st.created_at), COALESCE(st.completed_at, st.created_at)), 0)) AS avg_steril_sec,
      AVG(GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(r.started_at, r.created_at), COALESCE(d.completed_at, d.created_at)), 0)) AS avg_turnaround_sec
    FROM dirty_receipts r
    LEFT JOIN washings w ON w.receipt_id = r.id
    LEFT JOIN packagings p ON p.receipt_id = r.id
    LEFT JOIN sterilization_items si ON si.packaging_id = p.id
    LEFT JOIN sterilizations st ON st.id = si.sterilization_id
    LEFT JOIN sterile_stock s ON s.packaging_id = p.id
    LEFT JOIN distributions d ON d.stock_id = s.id
    WHERE r.receipt_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `);

  res.json({
    success: true,
    data: items,
    kpi: {
      total_receipts: Number(kpi?.total_receipts || 0),
      avg_wash_duration: formatDurationSec(kpi?.avg_wash_sec),
      avg_steril_duration: formatDurationSec(kpi?.avg_steril_sec),
      avg_turnaround_duration: formatDurationSec(kpi?.avg_turnaround_sec),
    },
    pagination: {
      page,
      limit,
      total: Number(total || 0),
      totalPages: Math.ceil(Number(total || 0) / limit),
    },
  });
}));

// ---------- Konfirmasi Penerimaan Alat Kotor 1-Klik (Resti, Alvin, Admin) ----------
router.post('/dirty-receipts/:id(\\d+)/confirm-receipt', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const officerName = sanitizeText(req.body.receiver_name) || req.user.name;
  const now = nowDateTimeStr();

  const [[existing]] = await pool.query('SELECT * FROM dirty_receipts WHERE id = ?', [id]);
  if (!existing) throw new HttpError(404, 'Data alat kotor tidak ditemukan');

  await pool.query(
    'UPDATE dirty_receipts SET receiver_name = ?, confirmed_at = ?, confirmed_by = ?, completed_at = COALESCE(completed_at, ?), status = "Diterima" WHERE id = ?',
    [officerName, now, officerName, now, id]
  );

  const [[fresh]] = await pool.query(
    'SELECT r.*, u.name AS unit_name FROM dirty_receipts r LEFT JOIN units u ON u.id = r.unit_id WHERE r.id = ?',
    [id]
  );

  await recordAdminNotification(null, {
    type: 'RECEIPT',
    title: `Konfirmasi Penerimaan: ${fresh.item_name} (${officerName})`,
    unit_id: fresh.unit_id,
    unit_name: fresh.unit_name,
    item_name: fresh.item_name,
    quantity: fresh.quantity,
    unit_label: fresh.unit_label,
    barcode: fresh.barcode,
    officer_sender: fresh.sender_name,
    officer_receiver: officerName,
    signature_sender: fresh.sender_signature,
    signature_receiver: fresh.receiver_signature,
    trx_date: fresh.receipt_date,
    trx_time: now.slice(11, 16),
    ref_table: 'dirty_receipts',
    ref_id: id,
    data_payload: fresh,
  });

  res.json({ success: true, message: `Alat kotor ${fresh.barcode} berhasil diterima oleh ${officerName}`, data: fresh });
}));

// ---------- Alur Cepat 1-Klik Tahapan CSSD Khusus Admin (Pencucian -> Steril -> Siap Distribusi) ----------
router.post('/dirty-receipts/:id(\\d+)/quick-advance', auth, allow('admin'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const targetStage = parseInt(req.body.target_stage, 10);
  const officerName = req.user.name;
  const now = nowDateTimeStr();
  const today = todayStr();

  const [[receipt]] = await pool.query('SELECT * FROM dirty_receipts WHERE id = ?', [id]);
  if (!receipt) throw new HttpError(404, 'Data alat kotor tidak ditemukan');
  if (receipt.status === 'Karantina') throw new HttpError(409, 'Alat dalam karantina');

  await withTx(async (conn) => {
    if (targetStage === 2) {
      await conn.query(`
        INSERT INTO washings (receipt_id, wash_date, method, liquid, duration_min, officer, started_at, completed_at)
        VALUES (?, ?, 'Washer', 'Enzimatis', 30, ?, ?, ?)
      `, [id, today, officerName, now, now]);
      await conn.query("UPDATE dirty_receipts SET stage = 2, status = 'Proses' WHERE id = ?", [id]);
    } else if (targetStage === 3) {
      await conn.query(`
        INSERT INTO dryings (receipt_id, dry_date, is_dry, no_rust, function_ok, officer, started_at, completed_at)
        VALUES (?, ?, 1, 1, 1, ?, ?, ?)
      `, [id, today, officerName, now, now]);
      await conn.query("UPDATE dirty_receipts SET stage = 3, status = 'Proses' WHERE id = ?", [id]);
    } else if (targetStage === 4) {
      const pkgCode = await makeCode(conn, 'PK', today);
      await conn.query(`
        INSERT INTO packagings (receipt_id, package_type, material, barcode, quantity, unit_label, officer, pack_date, started_at, completed_at)
        VALUES (?, 'Set Instrumen', 'Pouches Medis', ?, ?, ?, ?, ?, ?, ?)
      `, [id, pkgCode, receipt.quantity, receipt.unit_label, officerName, today, now, now]);
      await conn.query("UPDATE dirty_receipts SET stage = 4, status = 'Proses' WHERE id = ?", [id]);
    } else if (targetStage === 5) {
      const [[pkg]] = await conn.query('SELECT id FROM packagings WHERE receipt_id = ? ORDER BY id DESC LIMIT 1', [id]);
      if (!pkg) throw new HttpError(400, 'Alat belum dikemas');
      const [[machine]] = await conn.query('SELECT id FROM machines WHERE type LIKE "%Steam%" OR type LIKE "%Autoclave%" LIMIT 1');
      const machineId = machine?.id || 1;
      const batchNo = `STM-${today.replace(/-/g, '')}-${id}`;
      const [stRes] = await conn.query(`
        INSERT INTO sterilizations (machine_id, cycle_no, batch_no, temperature, duration_min, officer, steril_date, started_at, completed_at)
        VALUES (?, '1', ?, 134, 45, ?, ?, ?, ?)
      `, [machineId, batchNo, officerName, today, now, now]);
      await conn.query(`
        INSERT INTO sterilization_items (sterilization_id, packaging_id) VALUES (?, ?)
      `, [stRes.insertId, pkg.id]);
      await conn.query("UPDATE dirty_receipts SET stage = 5, status = 'Proses' WHERE id = ?", [id]);
    } else if (targetStage === 6) {
      const [[stItem]] = await conn.query(`
        SELECT si.sterilization_id, p.id AS packaging_id, p.barcode AS pkg_barcode
        FROM packagings p
        JOIN sterilization_items si ON si.packaging_id = p.id
        WHERE p.receipt_id = ? ORDER BY p.id DESC LIMIT 1
      `, [id]);
      if (!stItem) throw new HttpError(400, 'Data kemasan atau sterilisasi tidak ditemukan');
      await conn.query(`
        INSERT INTO verifications (sterilization_id, condition_packaging, chem_internal, chem_external, bio_indicator, bowie_dick, result, officer, verify_date, started_at, completed_at)
        VALUES (?, 'Baik', 'Sesuai', 'Sesuai', 'Sesuai', 'Sesuai', 'Lulus', ?, ?, ?, ?)
      `, [stItem.sterilization_id, officerName, today, now, now]);

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      const expDateStr = expiryDate.toISOString().slice(0, 10);
      const stockBarcode = `DS-${receipt.barcode.replace(/^AK-/, '')}`;
      await conn.query(`
        INSERT INTO sterile_stock (packaging_id, barcode, item_name, unit_id, quantity, unit_label, sterilized_date, expiry_date, status, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Tersedia', ?, ?)
        ON DUPLICATE KEY UPDATE status = 'Tersedia'
      `, [stItem.packaging_id, stockBarcode, receipt.item_name, receipt.unit_id, receipt.quantity, receipt.unit_label, today, expDateStr, now, now]);
      await conn.query("UPDATE dirty_receipts SET stage = 6, status = 'Selesai' WHERE id = ?", [id]);
    }
  });

  res.json({ success: true, message: `Tahapan proses berhasil dimajukan ke Tahap ${targetStage}` });
}));

// ---------- Log Penggunaan Mesin Washer dan Steam (Request 3) ----------
registerCrud({
  path: 'machine-logs',
  table: 'machine_usage_logs',
  from: 'machine_usage_logs t LEFT JOIN machines m ON m.id = t.machine_id',
  select: `t.*, m.code AS machine_code,
    GREATEST(TIMESTAMPDIFF(SECOND, t.started_at, t.completed_at), 0) AS process_seconds`,
  search: ['t.log_code', 't.machine_name', 't.officer', 't.cycle_batch_no', 't.load_description'],
  sort: { id: 't.id', log_code: 't.log_code', log_date: 't.log_date', started_at: 't.started_at', machine_name: 't.machine_name', officer: 't.officer' },
  defaultSort: 'id',
  filters: { machine_type: 't.machine_type', process_result: 't.process_result', has_delay_issue: 't.has_delay_issue', machine_id: 't.machine_id' },
  dateColumn: 't.log_date',
  timeColumn: 'TIME(t.started_at)',
  exportColumns: [
    ['log_code', 'Kode Log'], ['log_date', 'Tanggal'], ['machine_type', 'Tipe Mesin'], ['machine_name', 'Nama Mesin'],
    ['started_time', 'Jam Mulai'], ['completed_time', 'Jam Selesai'], ['process_duration', 'Durasi Mesin'],
    ['cycle_batch_no', 'No. Siklus / Batch'], ['officer', 'Petugas (Operator)'], ['load_description', 'Muatan / Alat'],
    ['temperature', 'Suhu (°C)'], ['pressure_bar', 'Tekanan (Bar)'], ['process_result', 'Hasil Proses'],
    ['has_delay_issue', 'Ada Kendala'], ['delay_reason', 'Alasan Kendala / Keterlambatan'], ['action_taken', 'Tindakan yang Dilakukan'],
  ],
  roles: { read: ['admin'], write: ['admin'], remove: ['admin'] },
  fields: [
    field('log_code', 'string', { label: 'Kode Log', max: 50, createOnly: true }),
    field('machine_type', 'enum', { values: ['Washer', 'Steam'], default: 'Washer', label: 'Tipe Mesin', required: true }),
    field('machine_id', 'int', { label: 'Mesin' }),
    field('machine_name', 'string', { required: true, max: 100, label: 'Nama Mesin' }),
    field('officer', 'string', { required: true, max: 100, label: 'Nama Petugas Operator' }),
    field('log_date', 'date', { default: todayStr, label: 'Tanggal' }),
    field('started_at', 'datetime', { required: true, label: 'Waktu Mulai' }),
    field('completed_at', 'datetime', { required: true, label: 'Waktu Selesai' }),
    field('cycle_batch_no', 'string', { required: true, max: 50, label: 'Nomor Siklus / Batch' }),
    field('load_description', 'string', { required: true, label: 'Muatan / Instrumen', max: 500 }),
    field('temperature', 'number', { label: 'Suhu (°C)' }),
    field('pressure_bar', 'number', { label: 'Tekanan (Bar)' }),
    field('duration_min', 'int', { label: 'Durasi (menit)' }),
    field('process_result', 'enum', { values: ['Berhasil', 'Gagal'], default: 'Berhasil', label: 'Hasil Proses', required: true }),
    field('has_delay_issue', 'bool', { default: 0, label: 'Ada Kendala / Keterlambatan' }),
    field('delay_reason', 'string', { label: 'Alasan Kendala / Keterlambatan', max: 500 }),
    field('action_taken', 'string', { label: 'Tindakan yang Dilakukan', max: 500 }),
    field('notes', 'string', { label: 'Catatan Tambahan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    if (!data.started_at) data.started_at = nowDateTimeStr();
    if (!data.completed_at) data.completed_at = nowDateTimeStr();
    if (!data.log_date) data.log_date = data.started_at.slice(0, 10);
    const prefix = data.machine_type === 'Washer' ? 'WSH' : 'STM';
    data.log_code = data.log_code || (await makeCode(conn, prefix, data.log_date));

    if (data.process_result === 'Gagal' || Boolean(data.has_delay_issue)) {
      if (!data.delay_reason || !data.delay_reason.trim()) {
        throw new HttpError(422, 'Alasan kendala / keterlambatan wajib diisi jika hasil proses gagal atau ada kendala');
      }
      if (!data.action_taken || !data.action_taken.trim()) {
        throw new HttpError(422, 'Tindakan yang dilakukan wajib diisi jika hasil proses gagal atau ada kendala');
      }
    }
  },
  async beforeUpdate(conn, data, ctx, existing) {
    const isFailed = data.process_result ? data.process_result === 'Gagal' : existing.process_result === 'Gagal';
    const hasDelay = data.has_delay_issue !== undefined ? Boolean(data.has_delay_issue) : Boolean(existing.has_delay_issue);
    if (isFailed || hasDelay) {
      const reason = data.delay_reason !== undefined ? data.delay_reason : existing.delay_reason;
      const action = data.action_taken !== undefined ? data.action_taken : existing.action_taken;
      if (!reason || !reason.trim()) {
        throw new HttpError(422, 'Alasan kendala / keterlambatan wajib diisi');
      }
      if (!action || !action.trim()) {
        throw new HttpError(422, 'Tindakan yang dilakukan wajib diisi');
      }
    }
  },
});

// ---------- Kebutuhan Alat & Set Unit (Request 4) ----------
registerCrud({
  path: 'unit-requisitions',
  table: 'unit_requisitions',
  from: 'unit_requisitions t JOIN units u ON u.id = t.unit_id LEFT JOIN items i ON i.id = t.item_id',
  select: 't.*, u.name AS unit_name, i.code AS item_code',
  search: ['t.code', 't.procedure_name', 't.item_name', 'u.name', 't.requester_name'],
  sort: { id: 't.id', code: 't.code', procedure_date: 't.procedure_date', procedure_name: 't.procedure_name', item_name: 't.item_name', unit_name: 'u.name', status: 't.status' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { unit_id: 't.unit_id', status: 't.status', urgency: 't.urgency' },
  dateColumn: 't.procedure_date',
  exportColumns: [
    ['code', 'Kode Permintaan'], ['procedure_date', 'Tgl Tindakan'], ['procedure_time', 'Jam Tindakan'],
    ['unit_name', 'Unit Pemohon'], ['procedure_name', 'Nama Tindakan / Operasi'], ['item_name', 'Nama Alat / Set'],
    ['quantity', 'Jumlah Kebutuhan'], ['unit_label', 'Satuan'], ['urgency', 'Urgensi'], ['requester_name', 'Petugas Pemohon'],
    ['status', 'Status'], ['processed_by', 'Diproses Oleh'], ['notes', 'Catatan'],
  ],
  roles: { read: ['admin', 'petugas', 'unit'], write: ['admin', 'petugas', 'unit'], remove: ['admin'] },
  fields: [
    field('code', 'string', { label: 'Kode', max: 50, createOnly: true }),
    field('unit_id', 'int', { required: true, min: 1, label: 'Unit Pemohon' }),
    field('procedure_name', 'string', { required: true, max: 150, label: 'Nama Tindakan / Operasi' }),
    field('procedure_date', 'date', { default: todayStr, label: 'Tanggal Tindakan', required: true }),
    field('procedure_time', 'string', { label: 'Jam Tindakan (WIB)', max: 10 }),
    field('item_id', 'int', { label: 'Alat / Set' }),
    field('item_name', 'string', { required: true, max: 150, label: 'Nama Alat / Set' }),
    field('quantity', 'int', { required: true, min: 1, default: 1, label: 'Jumlah Kebutuhan' }),
    field('unit_label', 'string', { default: 'set', max: 30, label: 'Satuan' }),
    field('requester_name', 'string', { required: true, max: 100, label: 'Nama Petugas Pemohon' }),
    field('urgency', 'enum', { values: ['Rutin', 'Segera / Cito', 'Elektif'], default: 'Rutin', label: 'Tingkat Urgensi' }),
    field('status', 'enum', { values: ['Diajukan', 'Disiapkan CSSD', 'Siap Diambil', 'Selesai', 'Ditolak'], default: 'Diajukan', label: 'Status' }),
    field('notes', 'string', { label: 'Catatan Kebutuhan', max: 500 }),
    field('rejection_reason', 'string', { label: 'Alasan Penolakan', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    if (ctx.user.role === 'unit' && ctx.user.unit_id) {
      data.unit_id = ctx.user.unit_id;
    }
    data.code = data.code || (await makeCode(conn, 'REQ', data.procedure_date || todayStr()));
    data.status = 'Diajukan';
  },
  async afterCreate(conn, id, data, ctx) {
    const [[fresh]] = await conn.query(
      'SELECT r.*, u.name AS unit_name FROM unit_requisitions r LEFT JOIN units u ON u.id = r.unit_id WHERE r.id = ?',
      [id]
    );
    if (fresh) {
      await recordAdminNotification(conn, {
        type: 'UNIT_REQUEST',
        title: `Kebutuhan Alat: ${fresh.procedure_name} (${fresh.quantity} ${fresh.unit_label})`,
        unit_id: fresh.unit_id,
        unit_name: fresh.unit_name,
        item_name: fresh.item_name,
        quantity: fresh.quantity,
        unit_label: fresh.unit_label,
        barcode: fresh.code,
        officer_sender: fresh.requester_name,
        officer_receiver: 'Admin CSSD',
        trx_date: fresh.procedure_date,
        trx_time: fresh.procedure_time || null,
        ref_table: 'unit_requisitions',
        ref_id: id,
        data_payload: fresh,
      });
    }
  },
});

router.post('/unit-requisitions/:id(\\d+)/status', auth, allow('admin', 'petugas'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const status = sanitizeText(req.body.status || '');
  const allowed = ['Diajukan', 'Disiapkan CSSD', 'Siap Diambil', 'Selesai', 'Ditolak'];
  if (!allowed.includes(status)) throw new HttpError(422, 'Status tidak valid');

  const rejectionReason = status === 'Ditolak' ? sanitizeText(req.body.rejection_reason || '') : null;
  await pool.query(
    'UPDATE unit_requisitions SET status = ?, processed_by = ?, rejection_reason = ? WHERE id = ?',
    [status, req.user.name, rejectionReason, id]
  );
  res.json({ success: true, message: `Status permintaan diubah menjadi ${status}` });
}));

// ---------- Pengajuan Alat & Set Baru oleh Unit (Request 4) ----------
registerCrud({
  path: 'item-proposals',
  table: 'item_proposals',
  from: 'item_proposals t JOIN units u ON u.id = t.unit_id',
  select: 't.*, u.name AS unit_name',
  search: ['t.code', 't.item_name', 'u.name', 't.requester_name', 't.specification'],
  sort: { id: 't.id', code: 't.code', item_name: 't.item_name', category: 't.category', unit_name: 'u.name', status: 't.status', created_at: 't.created_at' },
  defaultSort: 'id',
  unitColumn: 't.unit_id',
  filters: { unit_id: 't.unit_id', status: 't.status', category: 't.category' },
  dateColumn: 'DATE(t.created_at)',
  exportColumns: [
    ['code', 'Kode Pengajuan'], ['item_name', 'Nama Alat / Set Baru'], ['category', 'Kategori'],
    ['unit_name', 'Unit Pengaju'], ['proposed_quantity', 'Jumlah'], ['unit_label', 'Satuan'],
    ['specification', 'Spesifikasi / Rincian'], ['reason', 'Alasan Pengajuan'], ['requester_name', 'Petugas Pengaju'],
    ['status', 'Status'], ['verified_by', 'Diverifikasi Oleh'], ['admin_notes', 'Catatan Admin'],
  ],
  roles: { read: ['admin', 'petugas', 'unit'], write: ['admin', 'petugas', 'unit'], remove: ['admin'] },
  fields: [
    field('code', 'string', { label: 'Kode', max: 50, createOnly: true }),
    field('unit_id', 'int', { required: true, min: 1, label: 'Unit Pengaju' }),
    field('item_name', 'string', { required: true, max: 150, label: 'Nama Alat / Set Baru' }),
    field('category', 'enum', { values: ['Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Alat DTT'], default: 'Set Instrumen', label: 'Kategori' }),
    field('proposed_quantity', 'int', { required: true, min: 1, default: 1, label: 'Jumlah yang Diajukan' }),
    field('unit_label', 'string', { default: 'set', max: 30, label: 'Satuan' }),
    field('specification', 'string', { label: 'Spesifikasi / Isi Instrumen', max: 500 }),
    field('reason', 'string', { required: true, label: 'Alasan Kebutuhan Baru', max: 500 }),
    field('requester_name', 'string', { required: true, max: 100, label: 'Petugas Pengaju' }),
    field('status', 'enum', { values: ['Menunggu Verifikasi', 'Disetujui', 'Ditolak'], default: 'Menunggu Verifikasi', label: 'Status' }),
    field('admin_notes', 'string', { label: 'Catatan Admin', max: 500 }),
  ],
  async beforeCreate(conn, data, ctx) {
    if (ctx.user.role === 'unit' && ctx.user.unit_id) {
      data.unit_id = ctx.user.unit_id;
    }
    data.code = data.code || (await makeCode(conn, 'PAB', todayStr()));
    data.status = 'Menunggu Verifikasi';
  },
  async afterCreate(conn, id, data, ctx) {
    const [[fresh]] = await conn.query(
      'SELECT p.*, u.name AS unit_name FROM item_proposals p LEFT JOIN units u ON u.id = p.unit_id WHERE p.id = ?',
      [id]
    );
    if (fresh) {
      await recordAdminNotification(conn, {
        type: 'NEW_ITEM_REQUEST',
        title: `Pengajuan Alat/Set Baru: ${fresh.item_name} (${fresh.unit_name})`,
        unit_id: fresh.unit_id,
        unit_name: fresh.unit_name,
        item_name: fresh.item_name,
        quantity: fresh.proposed_quantity,
        unit_label: fresh.unit_label,
        barcode: fresh.code,
        officer_sender: fresh.requester_name,
        officer_receiver: 'Admin CSSD',
        trx_date: todayStr(),
        trx_time: nowDateTimeStr().slice(11, 16),
        ref_table: 'item_proposals',
        ref_id: id,
        data_payload: fresh,
      });
    }
  },
});

router.post('/item-proposals/:id(\\d+)/approve', auth, allow('admin'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  await withTx(async (conn) => {
    const [[prop]] = await conn.query('SELECT * FROM item_proposals WHERE id = ? FOR UPDATE', [id]);
    if (!prop) throw new HttpError(404, 'Data pengajuan tidak ditemukan');
    if (prop.status === 'Disetujui') throw new HttpError(409, 'Pengajuan ini sudah disetujui sebelumnya');

    // 1. Tambahkan ke master items
    await conn.query(`
      INSERT INTO items (code, name, category, unit_id, unit_label, shelf_life_months, is_active)
      VALUES (?, ?, ?, ?, ?, 3, 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1
    `, [
      prop.code,
      prop.item_name,
      prop.category,
      prop.unit_id,
      prop.unit_label || 'set',
    ]);

    // 2. Jika Set Instrumen, daftarkan juga ke instrument_sets
    if (prop.category === 'Set Instrumen') {
      await conn.query(`
        INSERT INTO instrument_sets (code, name, is_active, notes)
        VALUES (?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `, [
        prop.code,
        prop.item_name,
        prop.specification ? `Spesifikasi: ${prop.specification}` : 'Dari pengajuan unit',
      ]);
    }

    // 3. Update status proposal
    await conn.query(`
      UPDATE item_proposals
      SET status = 'Disetujui', verified_by = ?, admin_notes = ?
      WHERE id = ?
    `, [req.user.name, req.body.admin_notes || 'Disetujui dan didaftarkan ke Master Data Alat', id]);
  });

  res.json({ success: true, message: 'Pengajuan disetujui dan berhasil didaftarkan ke Master Data Alat' });
}));

router.post('/item-proposals/:id(\\d+)/reject', auth, allow('admin'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const notes = sanitizeText(req.body.admin_notes || '');
  if (!notes) throw new HttpError(422, 'Alasan penolakan wajib diisi');

  await pool.query(`
    UPDATE item_proposals
    SET status = 'Ditolak', verified_by = ?, admin_notes = ?
    WHERE id = ?
  `, [req.user.name, notes, id]);

  res.json({ success: true, message: 'Pengajuan berhasil ditolak' });
}));

/* ============================================================
 * APP
 * ============================================================ */
const app = express.Router();
// app.disable('x-powered-by');
// if (IS_PROD) app.set('trust proxy', 1);

// const corsOrigins = (env.CORS_ORIGIN || '*').split(',').map((o) => o.trim()).filter(Boolean);
// app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// app.use(cors({ origin: corsOrigins.includes('*') ? true : corsOrigins }));
// app.use(express.json({ limit: '1mb' }));

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
      const [[anySet]] = await pool.query('SELECT id FROM instrument_sets LIMIT 1');
      if (anySet?.id) {
        await pool.query(`
          INSERT INTO instrument_discrepancy_logs 
          (set_id, instrument_name, incident_type, quantity, unit_origin, officer, incident_date, notes, resolution_status)
          VALUES
          (?, 'Gunting episiotomi', 'Rusak', 1, 'Ruang Bersalin (VK)', 'Inge Kusryaningsih', CURDATE(), 'Gunting episiotomi mata gunting tumpul / dalam perbaikan teknisi', 'Belum Selesai')
        `, [anySet.id]);
      }
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

    await addCol('items', "unit_id INT UNSIGNED DEFAULT NULL AFTER id");
    try {
      await pool.query('ALTER TABLE items ADD KEY idx_items_unit_id (unit_id)');
    } catch (err) {}
    await addCol('items', "process_type ENUM('Steril','DTT') NOT NULL DEFAULT 'Steril'");
    await addCol('items', "unit_label VARCHAR(50) NOT NULL DEFAULT 'Set'");
    await addCol('dirty_receipts', 'confirmed_at DATETIME DEFAULT NULL');
    await addCol('dirty_receipts', 'confirmed_by VARCHAR(100) DEFAULT NULL');

    // Pastikan kolom started_at & completed_at tersedia di seluruh tabel tahapan CSSD & DTT
    const timingTables = [
      'dirty_receipts',
      'washings',
      'dryings',
      'packagings',
      'sterilizations',
      'verifications',
      'sterile_stock',
      'distributions',
      'dtt_receipts',
      'dtt_distributions',
    ];
    for (const tbl of timingTables) {
      await addCol(tbl, 'started_at DATETIME DEFAULT NULL');
      await addCol(tbl, 'completed_at DATETIME DEFAULT NULL');
    }

    // Backfill data lama yang belum memiliki started_at / completed_at
    const backfillPairs = [
      ['dirty_receipts', 'created_at', true],
      ['washings', 'created_at', true],
      ['dryings', 'created_at', true],
      ['packagings', 'created_at', true],
      ['sterilizations', 'created_at', true],
      ['verifications', 'created_at', true],
      ['sterile_stock', 'created_at', false],
      ['distributions', 'created_at', true],
      ['dtt_receipts', 'COALESCE(receipt_datetime, created_at)', true],
      ['dtt_distributions', 'COALESCE(dist_datetime, created_at)', true],
    ];
    for (const [tbl, fallbackExpr, fillCompleted] of backfillPairs) {
      try {
        await pool.query(`UPDATE ${tbl} SET started_at = ${fallbackExpr} WHERE started_at IS NULL`);
        if (fillCompleted) {
          await pool.query(`UPDATE ${tbl} SET completed_at = COALESCE(started_at, ${fallbackExpr}) WHERE completed_at IS NULL`);
        } else {
          await pool.query(`UPDATE ${tbl} SET completed_at = COALESCE(started_at, ${fallbackExpr}) WHERE completed_at IS NULL AND status != 'Tersedia'`);
        }
      } catch (err) {}
    }

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

async function ensureNewFeatureTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_notifications (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        type ENUM('RECEIPT', 'DISTRIBUTION', 'DTT_RECEIPT', 'DTT_DISTRIBUTION', 'UNIT_REQUEST', 'NEW_ITEM_REQUEST') NOT NULL,
        title VARCHAR(150) NOT NULL,
        unit_id INT UNSIGNED DEFAULT NULL,
        unit_name VARCHAR(100) DEFAULT NULL,
        item_name VARCHAR(255) DEFAULT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        unit_label VARCHAR(30) DEFAULT 'set',
        barcode VARCHAR(50) DEFAULT NULL,
        officer_sender VARCHAR(100) DEFAULT NULL,
        officer_receiver VARCHAR(100) DEFAULT NULL,
        signature_sender TEXT DEFAULT NULL,
        signature_receiver TEXT DEFAULT NULL,
        trx_date DATE DEFAULT NULL,
        trx_time VARCHAR(10) DEFAULT NULL,
        ref_table VARCHAR(50) NOT NULL,
        ref_id INT UNSIGNED NOT NULL,
        data_payload LONGTEXT DEFAULT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_notif_read_created (is_read, created_at),
        KEY idx_notif_type (type),
        KEY idx_notif_ref (ref_table, ref_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS machine_usage_logs (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        log_code VARCHAR(50) NOT NULL,
        machine_type ENUM('Washer', 'Steam') NOT NULL,
        machine_id INT UNSIGNED DEFAULT NULL,
        machine_name VARCHAR(100) NOT NULL,
        officer VARCHAR(100) NOT NULL,
        log_date DATE NOT NULL,
        started_at DATETIME NOT NULL,
        completed_at DATETIME NOT NULL,
        cycle_batch_no VARCHAR(50) NOT NULL,
        load_description TEXT NOT NULL,
        temperature DECIMAL(5,2) DEFAULT NULL,
        pressure_bar DECIMAL(4,2) DEFAULT NULL,
        duration_min INT UNSIGNED DEFAULT NULL,
        process_result ENUM('Berhasil', 'Gagal') NOT NULL DEFAULT 'Berhasil',
        has_delay_issue TINYINT(1) NOT NULL DEFAULT 0,
        delay_reason TEXT DEFAULT NULL,
        action_taken TEXT DEFAULT NULL,
        notes VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_mlog_code (log_code),
        KEY idx_mlog_date (log_date),
        KEY idx_mlog_type (machine_type),
        KEY idx_mlog_result (process_result),
        CONSTRAINT fk_mlog_machine FOREIGN KEY (machine_id) REFERENCES machines (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS unit_requisitions (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL,
        unit_id INT UNSIGNED NOT NULL,
        procedure_name VARCHAR(150) NOT NULL,
        procedure_date DATE NOT NULL,
        procedure_time VARCHAR(10) DEFAULT NULL,
        item_id INT UNSIGNED DEFAULT NULL,
        item_name VARCHAR(150) NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        unit_label VARCHAR(30) NOT NULL DEFAULT 'set',
        requester_name VARCHAR(100) NOT NULL,
        urgency ENUM('Rutin', 'Segera / Cito', 'Elektif') NOT NULL DEFAULT 'Rutin',
        status ENUM('Diajukan', 'Disiapkan CSSD', 'Siap Diambil', 'Selesai', 'Ditolak') NOT NULL DEFAULT 'Diajukan',
        notes TEXT DEFAULT NULL,
        processed_by VARCHAR(100) DEFAULT NULL,
        rejection_reason TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_req_code (code),
        KEY idx_req_unit (unit_id),
        KEY idx_req_date (procedure_date),
        KEY idx_req_status (status),
        CONSTRAINT fk_req_unit FOREIGN KEY (unit_id) REFERENCES units (id),
        CONSTRAINT fk_req_item FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_proposals (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL,
        unit_id INT UNSIGNED NOT NULL,
        item_name VARCHAR(150) NOT NULL,
        category ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Alat DTT') NOT NULL DEFAULT 'Set Instrumen',
        proposed_quantity INT UNSIGNED NOT NULL DEFAULT 1,
        unit_label VARCHAR(30) NOT NULL DEFAULT 'set',
        specification TEXT DEFAULT NULL,
        reason TEXT NOT NULL,
        requester_name VARCHAR(100) NOT NULL,
        status ENUM('Menunggu Verifikasi', 'Disetujui', 'Ditolak') NOT NULL DEFAULT 'Menunggu Verifikasi',
        verified_by VARCHAR(100) DEFAULT NULL,
        admin_notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_prop_code (code),
        KEY idx_prop_unit (unit_id),
        KEY idx_prop_status (status),
        CONSTRAINT fk_prop_unit FOREIGN KEY (unit_id) REFERENCES units (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Pastikan mesin Washer & Steam tersedia
    const washerPresets = [
      { code: 'WD1', name: 'Washer Disinfector 1', type: 'Washer' },
      { code: 'WD2', name: 'Washer Disinfector 2', type: 'Washer' },
      { code: 'AU1', name: 'Autoclave Steam 1', type: 'Steam' },
      { code: 'AU2', name: 'Autoclave Steam 2', type: 'Steam' },
      { code: 'ST1', name: 'Steam Sterilizer', type: 'Steam' },
      { code: 'PL1', name: 'Plasma Sterilizer', type: 'Plasma' },
    ];
    for (const m of washerPresets) {
      await pool.query(
        'INSERT INTO machines (code, name, type, is_active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type)',
        [m.code, m.name, m.type]
      );
    }
  } catch (err) {
    console.error('ensureNewFeatureTables notice:', err.message);
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
    await ensureNewFeatureTables();
  } catch (err) {
    console.error('Gagal terhubung ke database. Pastikan MySQL berjalan dan sql/database.sql sudah diimport.');
    console.error(err.message);
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`CSSD SMART API berjalan di http://localhost:${PORT}/api`));
}

if (require.main === module) start();

module.exports = app;
