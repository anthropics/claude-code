# ⚙️ Vercel Environment Variables Setup

## Informasi Penting
- **Frontend URL**: https://frontend-ovt70ebe7-bagus-sundarus-projects.vercel.app
- **Backend URL**: https://bagussundaru--ai-traders-shadow-backend-web.modal.run
- **Project**: bagus-sundarus-projects/frontend

## Langkah-Langkah Setup

### Opsi 1: Vercel Dashboard (DIREKOMENDASIKAN)

1. **Buka Vercel Dashboard**
   - Kunjungi: https://vercel.com/dashboard
   - Pilih project: `frontend`

2. **Buka Settings → Environment Variables**
   - Klik pada project frontend
   - Masuk ke tab **Settings**
   - Pilih **Environment Variables** dari sidebar

3. **Tambah Variable Pertama: NEXT_PUBLIC_API_URL**
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://bagussundaru--ai-traders-shadow-backend-web.modal.run`
   - Environment: Select `Production` only
   - Klik **Save**

4. **Tambah Variable Kedua: NEXT_PUBLIC_WS_URL**
   - Name: `NEXT_PUBLIC_WS_URL`
   - Value: `wss://bagussundaru--ai-traders-shadow-backend-web.modal.run`
   - Environment: Select `Production` only
   - Klik **Save**

5. **Redeploy Frontend**
   - Klik pada tab **Deployments**
   - Cari deployment terakhir
   - Klik **3 dots** → **Redeploy**
   - Tunggu hingga selesai (biasanya 1-2 menit)

### Opsi 2: .env.production File (Sudah dibuat)

File `.env.production` sudah dibuat di:
```
d:\claude\claude-code\ai-traders-shadow\frontend\.env.production
```

Isi file:
```env
NEXT_PUBLIC_API_URL=https://bagussundaru--ai-traders-shadow-backend-web.modal.run
NEXT_PUBLIC_WS_URL=wss://bagussundaru--ai-traders-shadow-backend-web.modal.run
```

Untuk menggunakan ini:
1. Push ke GitHub
2. Vercel akan otomatis rebuild dengan env vars dari file

### Verifikasi Setup

Setelah redeploy selesai:

1. **Buka Frontend**
   - Kunjungi: https://frontend-ovt70ebe7-bagus-sundarus-projects.vercel.app

2. **Buka Browser Console (F12)**
   - Tekan `F12` atau right-click → Inspect
   - Masuk ke tab **Console**

3. **Cari Log WebSocket**
   - Harus melihat: `[WebSocket] Connecting to wss://bagussundaru--ai-traders-shadow-backend-web.modal.run/ws/1...`
   - Bukan lagi: `ws://localhost:8000`

4. **Periksa Status**
   - Jika successful: `[WebSocket] Connected successfully`
   - Jika error tetap: Lihat error message di console

## Troubleshooting

### Error: "WebSocket Disconnected"
**Solusi**:
- Pastikan environment variables sudah disave di Vercel
- Lakukan redeploy di Vercel dashboard
- Tunggu 2-3 menit untuk propagasi global CDN
- Clear browser cache (Ctrl+Shift+Delete)

### Error: "Cannot GET /ws/..."
**Solusi**:
- Backend endpoint mungkin offline
- Periksa: https://bagussundaru--ai-traders-shadow-backend-web.modal.run/health
- Jika error: Deploy ulang backend dengan:
  ```bash
  python -m modal deploy -m modal_simple
  ```

### Environment Variables Tidak Ter-apply
**Solusi**:
1. Verifikasi env vars di Vercel dashboard
2. Klik **Redeploy** bukan hanya push code
3. Clear browser cache
4. Refresh halaman (Ctrl+F5)

## Monitoring Backend

### Check Backend Status
```bash
curl https://bagussundaru--ai-traders-shadow-backend-web.modal.run/health
```

Respons yang diharapkan:
```json
{"status": "healthy", "service": "ai-traders-shadow-backend"}
```

### View Modal Dashboard
- https://modal.com/account/bagussundaru
- Lihat app instances dan logs

## Testing Checklist

- [ ] NEXT_PUBLIC_API_URL tersimpan di Vercel
- [ ] NEXT_PUBLIC_WS_URL tersimpan di Vercel
- [ ] Frontend di-redeploy setelah env vars set
- [ ] Browser console menunjukkan WebSocket URL yang benar
- [ ] Backend endpoint /health accessible
- [ ] WebSocket berhasil connect (console: "Connected successfully")
- [ ] Real-time data mengalir dari backend
