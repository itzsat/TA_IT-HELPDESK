# 🖥️ IT Helpdesk App

Aplikasi IT Helpdesk berbasis web dengan sistem tiket, knowledge base, notifikasi real-time, dan NLP (Natural Language Processing) untuk rekomendasi solusi otomatis.

> **Tugas Akhir** — Bagas Satria Pamungkas (4342211001)  
> Dibangun dengan React + TypeScript + Supabase

---

## 🧰 Teknologi

| Layer | Teknologi |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI Components | shadcn/ui, Tailwind CSS, Radix UI |
| Backend / Database | Supabase (PostgreSQL + Auth + Realtime) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Email | Resend API (via Edge Function) |

---

## ⚙️ Prasyarat

Pastikan sudah terinstall:

- [Node.js](https://nodejs.org/) versi **18 atau lebih baru**
- [npm](https://www.npmjs.com/) (ikut serta dengan Node.js)
- Akun [Supabase](https://supabase.com) (gratis)

---

## 🚀 Cara Setup & Menjalankan

### 1. Clone Repository

```bash
git clone https://github.com/itzsat/TA_IT-HELPDESK.git
cd TA_IT-HELPDESK
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Supabase

#### a. Buat Project Supabase Baru
1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Catat **Project URL** dan **anon (public) key** dari:  
   `Settings → API → Project URL & Project API Keys`

#### b. Jalankan Migrasi Database
Di Supabase Dashboard → **SQL Editor**, jalankan file-file SQL berikut secara berurutan:

1. `supabase/migrations/20260512180000_kv_store_688b6236.sql`
2. `supabase/migrations/20260718000001_notifications.sql`
3. `supabase/migrations/20260718000002_enable_realtime_and_email.sql`
4. `supabase/migrations/unified_notifications_setup.sql` *(opsional, jika diperlukan)*

> 💡 **Alternatif**: Jika kamu punya [Supabase CLI](https://supabase.com/docs/guides/cli), jalankan:
> ```bash
> supabase link --project-ref YOUR_PROJECT_REF
> supabase db push
> ```

#### c. Buat User Admin (Opsional)
Di Supabase Dashboard → **Authentication → Users → Invite User**, buat akun untuk login pertama kali.

### 4. Konfigurasi Environment Variable

Salin file contoh dan isi dengan kredensial Supabase kamu:

```bash
cp .env.example .env.local
```

Buka `.env.local` dan isi:

```env
VITE_SUPABASE_URL=https://XXXXXXXXXXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

> ⚠️ **Jangan commit file `.env.local`** ke Git! File ini sudah ada di `.gitignore`.

### 5. Jalankan Aplikasi

```bash
npm run dev
```

Buka browser di: **http://localhost:3000**

---

## 📁 Struktur Project

```
TA_IT-HELPDESK/
├── src/
│   ├── components/         # Komponen UI utama
│   │   ├── AuthPage.tsx        # Halaman login/register
│   │   ├── UserDashboard.tsx   # Dashboard pengguna biasa
│   │   ├── SupportDashboard.tsx # Dashboard IT Support
│   │   ├── SupportTickets.tsx  # Manajemen tiket support
│   │   ├── UserTickets.tsx     # Riwayat tiket user
│   │   ├── KnowledgeBaseManager.tsx # Manajemen knowledge base
│   │   ├── ProblemReportForm.tsx    # Form laporan masalah + NLP
│   │   ├── NotificationBell.tsx     # Notifikasi real-time
│   │   └── UserManagement.tsx       # Manajemen user (admin)
│   ├── hooks/
│   │   └── useNotifications.ts  # Hook notifikasi Supabase Realtime
│   ├── utils/supabase/
│   │   ├── SupabaseClient.ts    # Inisialisasi Supabase client
│   │   └── publicConfig.ts      # Konfigurasi URL & key
│   └── rules.json              # Aturan NLP / Forward Chaining
├── supabase/
│   ├── functions/              # Edge Functions (Deno)
│   │   └── send-email/         # Pengiriman email via Resend
│   └── migrations/             # Skema database SQL
├── .env.example                # Contoh konfigurasi environment
└── vite.config.ts              # Konfigurasi Vite + Proxy Supabase
```

---

## 🔑 Fitur Utama

- **Sistem Tiket** — User membuat laporan, IT Support merespons & menutup tiket
- **Knowledge Base** — Database solusi yang dapat dicari dan dikelola admin
- **NLP / Forward Chaining** — Rekomendasi solusi otomatis berdasarkan gejala masalah
- **Notifikasi Real-time** — Notifikasi instan via Supabase Realtime
- **Manajemen User** — Admin dapat mengelola role dan akses pengguna
- **Email Otomatis** — Notifikasi email via Supabase Edge Function + Resend

---

## 🛠️ Script yang Tersedia

```bash
npm run dev          # Jalankan development server (port 3000)
npm run build        # Build untuk production
```

---

## ❓ Troubleshooting

**App tidak bisa connect ke Supabase?**
- Pastikan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di `.env.local` sudah benar
- Restart dev server setelah mengubah `.env.local`

**Tabel tidak ditemukan / error database?**
- Pastikan semua file migrasi sudah dijalankan di Supabase SQL Editor

**Login gagal?**
- Pastikan user sudah dibuat di Supabase Dashboard → Authentication → Users

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan Tugas Akhir. Hak cipta © 2026 Bagas Satria Pamungkas.