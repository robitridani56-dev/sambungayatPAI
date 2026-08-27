/**
 * ==========================================================================
 *  BACKEND — Sambung Ayat & Tebak Arti (PAI SMA/SMK)
 *  Google Apps Script + Google Sheets sebagai database.
 *  Frontend (index.html) di-hosting terpisah di Vercel, dan memanggil
 *  Web App URL dari script ini via fetch(). Semua request pakai POST
 *  dengan body JSON (dikirim sebagai text/plain agar tidak kena CORS
 *  preflight), berisi { action, payload }.
 * ==========================================================================
 *
 *  CARA SETUP:
 *  1. Buat Google Spreadsheet baru (boleh kosong, sheet akan dibuat otomatis).
 *     Salin ID-nya dari URL: https://docs.google.com/spreadsheets/d/ID_INI/edit
 *  2. Ekstensi ▸ Apps Script, hapus isi default, tempel semua isi file ini.
 *  3. Isi konstanta SPREADSHEET_ID di bawah dengan ID yang disalin tadi.
 *  4. Jalankan sekali fungsi `setupAdminPassword` (ganti password di bawah dulu)
 *     lewat menu Run, supaya Script Property ADMIN_PASSWORD tersimpan.
 *  5. Deploy ▸ New deployment ▸ Web app.
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  6. Salin URL deployment (…/exec), tempel ke konstanta API_URL di index.html.
 *  7. (Opsional) Buka aplikasi lalu masuk sebagai Admin ▸ tab "Kelola Soal" ▸
 *     klik "Isi Data Default" sekali untuk mengisi sheet "Soal" dari data
 *     bawaan aplikasi.
 *
 *  Setiap ubah isi file ini di editor Apps Script, WAJIB deploy ulang
 *  (Deploy ▸ Manage deployments ▸ Edit ▸ New version) agar perubahan aktif.
 * ==========================================================================
 */

// ID Google Spreadsheet tempat data disimpan. Ambil dari URL spreadsheet:
// https://docs.google.com/spreadsheets/d/ID_ADA_DI_SINI/edit
// Wajib diisi jika Code.gs ini berupa project Apps Script berdiri sendiri
// (standalone), bukan yang dibuat lewat menu Ekstensi > Apps Script di
// dalam spreadsheet itu sendiri (container-bound).
const SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET';

const SHEET_SISWA = 'Siswa';
const SHEET_NILAI = 'Nilai';
const SHEET_SOAL  = 'Soal';

const HEADER_SISWA = ['Timestamp', 'Nama', 'Kelas', 'NIS_NISN'];
const HEADER_NILAI = ['Timestamp', 'Nama', 'Kelas', 'NIS_NISN', 'Mode', 'Skor', 'Benar', 'Total', 'Akurasi(%)', 'BeruntunTerbaik'];
const HEADER_SOAL  = ['ID', 'SurahID', 'SurahNama', 'SurahNum', 'NomorAyat', 'TeksArab', 'ArtiIndo'];

/* ---------------- Setup helper (jalankan manual sekali) ---------------- */
function setupAdminPassword() {
  const PASSWORD_AWAL = 'ubah-password-ini';
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', PASSWORD_AWAL);
  Logger.log('Password admin diset. Segera ganti lewat tab Kelola di Script Properties jika perlu.');
}

// Jalankan fungsi ini SEKALI secara manual (pilih di dropdown Run) untuk
// langsung membuat ketiga sheet (Siswa, Nilai, Soal) beserta headernya.
// Tanpa ini, sheet baru akan terbuat otomatis saat pertama kali ada yang
// daftar/menyimpan nilai/membuka panel admin — jadi kalau belum ada
// aktivitas sama sekali, sheet memang belum muncul.
function setupSheets() {
  getOrCreateSheet(SHEET_SISWA, HEADER_SISWA);
  getOrCreateSheet(SHEET_NILAI, HEADER_NILAI);
  getOrCreateSheet(SHEET_SOAL, HEADER_SOAL);
  Logger.log('Sheet Siswa, Nilai, dan Soal sudah dibuat di spreadsheet: ' + getSS().getUrl());
}

/* ---------------- Sheet helpers ---------------- */
function getSS() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.indexOf('GANTI_') !== 0) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // fallback: hanya berfungsi jika script ini "container-bound"
  // (dibuat lewat Ekstensi > Apps Script di dalam spreadsheet)
  return SpreadsheetApp.getActiveSpreadsheet();
}
function getOrCreateSheet(name, header) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  // pastikan kolom teks (NIS dsb) tidak diubah otomatis jadi angka/tanggal
  if (name === SHEET_SISWA || name === SHEET_NILAI) {
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), header.length).setNumberFormat('@');
  }
  return sh;
}

function readAllRows(sheetName, header) {
  const sh = getOrCreateSheet(sheetName, header);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const values = sh.getRange(2, 1, lastRow - 1, header.length).getValues();
  return values
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

/* ---------------- Web app entry points ---------------- */
function doGet(e) {
  return jsonOut({ ok: true, message: 'Backend Sambung Ayat & Tebak Arti aktif. Gunakan POST.' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    const payload = body.payload || {};
    let result;
    switch (action) {
      case 'register':      result = actionRegister(payload); break;
      case 'saveScore':      result = actionSaveScore(payload); break;
      case 'adminLogin':     result = actionAdminLogin(payload); break;
      case 'getRekap':       result = actionGetRekap(payload); break;
      case 'getSoal':        result = actionGetSoal(); break;
      case 'addSoal':        result = actionAddSoal(payload); break;
      case 'updateSoal':     result = actionUpdateSoal(payload); break;
      case 'deleteSoal':     result = actionDeleteSoal(payload); break;
      case 'seedDefaultSoal': result = actionSeedDefaultSoal(payload); break;
      case 'deleteNilai':    result = actionDeleteNilai(payload); break;
      default:
        result = { ok: false, error: 'Aksi tidak dikenal: ' + action };
    }
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkAdminPassword(pw) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  return real && pw && String(pw) === String(real);
}

/* ---------------- Actions: siswa & nilai ---------------- */
function actionRegister(p) {
  const nama = String(p.nama || '').trim();
  const kelas = String(p.kelas || '').trim();
  const nis = String(p.nis || '').trim();
  if (!nama || !kelas || !nis) {
    return { ok: false, error: 'Nama, kelas, dan NIS/NISN wajib diisi.' };
  }
  const sh = getOrCreateSheet(SHEET_SISWA, HEADER_SISWA);
  sh.appendRow([new Date(), nama, kelas, nis]);
  return { ok: true };
}

function actionSaveScore(p) {
  const sh = getOrCreateSheet(SHEET_NILAI, HEADER_NILAI);
  sh.appendRow([
    new Date(),
    String(p.nama || ''),
    String(p.kelas || ''),
    String(p.nis || ''),
    String(p.mode || ''),
    Number(p.skor || 0),
    Number(p.benar || 0),
    Number(p.total || 0),
    Number(p.akurasi || 0),
    Number(p.beruntun || 0),
  ]);
  return { ok: true };
}

function actionAdminLogin(p) {
  return { ok: checkAdminPassword(p.password) };
}

function actionGetRekap(p) {
  if (!checkAdminPassword(p.password)) return { ok: false, error: 'Password admin salah.' };
  const rows = readAllRows(SHEET_NILAI, HEADER_NILAI);
  // urutkan terbaru dulu
  rows.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
  return { ok: true, data: rows };
}

function actionDeleteNilai(p) {
  if (!checkAdminPassword(p.password)) return { ok: false, error: 'Password admin salah.' };
  const sh = getOrCreateSheet(SHEET_NILAI, HEADER_NILAI);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true };
  const tsTarget = String(p.timestamp || '');
  const namaTarget = String(p.nama || '');
  const values = sh.getRange(2, 1, lastRow - 1, HEADER_NILAI.length).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    const rowTs = new Date(values[i][0]).toString();
    if (rowTs === tsTarget && String(values[i][1]) === namaTarget) {
      sh.deleteRow(i + 2);
      break;
    }
  }
  return { ok: true };
}

/* ---------------- Actions: soal (kelola ayat) ---------------- */
function actionGetSoal() {
  const rows = readAllRows(SHEET_SOAL, HEADER_SOAL);
  return { ok: true, data: rows };
}

function actionAddSoal(p) {
  if (!checkAdminPassword(p.password)) return { ok: false, error: 'Password admin salah.' };
  const sh = getOrCreateSheet(SHEET_SOAL, HEADER_SOAL);
  const id = 'soal_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
  sh.appendRow([
    id,
    String(p.surahId || ''),
    String(p.surahNama || ''),
    Number(p.surahNum || 0),
    Number(p.nomorAyat || 0),
    String(p.teksArab || ''),
    String(p.artiIndo || ''),
  ]);
  return { ok: true, id: id };
}

function actionUpdateSoal(p) {
  if (!checkAdminPassword(p.password)) return { ok: false, error: 'Password admin salah.' };
  const sh = getOrCreateSheet(SHEET_SOAL, HEADER_SOAL);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'Belum ada data soal.' };
  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues().map(r => r[0]);
  const idx = ids.indexOf(String(p.id));
  if (idx === -1) return { ok: false, error: 'ID soal tidak ditemukan.' };
  const rowNum = idx + 2;
  sh.getRange(rowNum, 2, 1, 6).setValues([[
    String(p.surahId || ''),
    String(p.surahNama || ''),
    Number(p.surahNum || 0),
    Number(p.nomorAyat || 0),
    String(p.teksArab || ''),
    String(p.artiIndo || ''),
  ]]);
  return { ok: true };
}

function actionDeleteSoal(p) {
  if (!checkAdminPassword(p.password)) return { ok: false, error: 'Password admin salah.' };
  const sh = getOrCreateSheet(SHEET_SOAL, HEADER_SOAL);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true };
  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues().map(r => r[0]);
  const idx = ids.indexOf(String(p.id));
  if (idx === -1) return { ok: false, error: 'ID soal tidak ditemukan.' };
  sh.deleteRow(idx + 2);
  return { ok: true };
}

/* Mengisi sheet Soal dari data bawaan aplikasi (dikirim dari frontend),
   supaya admin tidak perlu mengetik ulang semua ayat secara manual.
   payload.items = [{surahId, surahNama, surahNum, nomorAyat, teksArab, artiIndo}, ...] */
function actionSeedDefaultSoal(p) {
  if (!checkAdminPassword(p.password)) return { ok: false, error: 'Password admin salah.' };
  const items = p.items || [];
  const sh = getOrCreateSheet(SHEET_SOAL, HEADER_SOAL);
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, HEADER_SOAL.length).clearContent();
  const rows = items.map((it, i) => [
    'soal_seed_' + i,
    String(it.surahId || ''),
    String(it.surahNama || ''),
    Number(it.surahNum || 0),
    Number(it.nomorAyat || 0),
    String(it.teksArab || ''),
    String(it.artiIndo || ''),
  ]);
  if (rows.length) sh.getRange(2, 1, rows.length, HEADER_SOAL.length).setValues(rows);
  return { ok: true, count: rows.length };
}
