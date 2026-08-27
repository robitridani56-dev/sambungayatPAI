# Panduan Setup — Sambung Ayat & Tebak Arti

Fitur baru: **daftar siswa**, **simpan nilai otomatis**, dan **panel admin**
(rekap nilai + kelola soal/ayat) dengan Google Sheets sebagai database.
Frontend (`index.html`) tetap file statis biasa — bisa langsung di-hosting
di Vercel, dan akan memanggil backend Google Apps Script lewat internet.

## 1. Buat backend (Google Apps Script + Sheets)

1. Buka https://sheet.new untuk membuat Google Spreadsheet kosong.
2. Di spreadsheet itu: **Ekstensi ▸ Apps Script**.
3. Hapus semua isi editor bawaan, lalu tempel seluruh isi file **`Code.gs`**
   yang saya buatkan.
4. Ganti nilai `PASSWORD_AWAL` di dalam fungsi `setupAdminPassword()` dengan
   password admin pilihan Bapak.
5. Jalankan fungsi `setupAdminPassword` sekali (pilih fungsinya di dropdown
   atas, klik ▶ Run). Izinkan akses saat diminta.
6. **Deploy ▸ New deployment**:
   - Klik ikon gear ▸ pilih **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik Deploy, lalu salin URL yang berakhiran `/exec`.

> Setiap kali isi `Code.gs` diubah lagi di kemudian hari, harus
> **Deploy ▸ Manage deployments ▸ Edit (pensil) ▸ New version** supaya
> perubahan aktif — deployment lama tidak otomatis update.

## 2. Sambungkan frontend ke backend

Di file `index.html`, cari baris ini (dekat awal tag `<script>`):

```js
const API_URL = 'GANTI_DENGAN_URL_WEB_APP_APPS_SCRIPT';
```

Ganti dengan URL `/exec` yang tadi disalin, contoh:

```js
const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Jika `API_URL` dibiarkan kosong/placeholder, aplikasi tetap berjalan
memakai data ayat bawaan (offline), tapi fitur daftar, rekap nilai, dan
kelola soal tidak akan aktif.

## 3. Isi data ayat ke sheet (sekali di awal)

1. Buka aplikasi di browser, klik **Admin** di bagian bawah halaman.
2. Masukkan password admin.
3. Buka tab **Kelola Soal**, klik **Isi Data Default**.
4. Ini akan mengisi sheet baru bernama **Soal** dengan seluruh ayat yang
   sudah ada di aplikasi (13 surah pendek Juz 30 + Al-Ma'idah 48-49).
5. Setelah itu, tambah/ubah/hapus ayat cukup lewat panel admin — tidak
   perlu edit kode lagi.

Sheet yang otomatis terbentuk di spreadsheet:
- **Siswa** — data pendaftaran siswa (Nama, Kelas, NIS/NISN).
- **Nilai** — histori hasil latihan tiap siswa (skor, akurasi, dll).
- **Soal** — bank ayat yang dipakai untuk membuat soal.

## 4. Deploy frontend ke Vercel

`index.html` adalah file statis biasa, jadi cukup:

1. Buat repo GitHub baru, upload `index.html` (isi `API_URL` sudah diisi).
2. Di https://vercel.com, **Add New ▸ Project**, import repo tersebut.
3. Framework preset: **Other** (tidak perlu build command).
4. Deploy. Selesai — siswa akses lewat URL Vercel, backend tetap di
   Google Apps Script.

## Alur pemakaian

- **Siswa**: buka halaman ▸ isi Nama/Kelas/NIS sekali (tersimpan di HP
  masing-masing) ▸ pilih mode & surah ▸ latihan ▸ nilai otomatis tercatat
  ke sheet **Nilai**.
- **Admin**: klik tautan **Admin** di footer ▸ masukkan password ▸
  lihat/filter rekap nilai semua siswa, atau kelola (tambah/ubah/hapus)
  ayat di bank soal.

## Catatan keamanan

Password admin diverifikasi di server (Apps Script), bukan tersimpan di
kode frontend — jadi tidak terlihat siapa pun yang membuka `index.html`.
Namun karena Web App di-set "Anyone" agar bisa diakses dari Vercel,
siapa pun yang tahu URL API bisa memanggil endpoint publik seperti
`getSoal`. Jangan taruh data sensitif di sheet ini.
