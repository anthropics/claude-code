# MCP sunucuları

Bu repo iki MCP sunucusu içerir. İkisi de TypeScript, stdio üzerinden çalışır ve
`.mcp.json` ile proje kapsamında tanımlıdır.

| Sunucu | Durum | Kaynak |
|---|---|---|
| `youtube` | Canlı API'ye karşı test edildi (11/11) | `mcp-servers/youtube-mcp-server/` |
| `instagram` | Yalnızca protokol testi (25/25); Graph API çağrıları doğrulanmadı | `mcp-servers/instagram-mcp-server/` |

Her sunucunun kendi README'si var ve asıl ayrıntı orada — bu sayfa kurulumu
anlatır.

## Kurulum

Sunucular derlenmiş JavaScript olarak çalışır, `dist/` ise git'te tutulmaz.
Klonladıktan sonra bir kez kurup derlemen gerekir:

```bash
./scripts/setup-youtube-mcp.sh          # bağımlılıkları kurar, derler, anahtarı yazar
```

Ya da elle:

```bash
cd mcp-servers/youtube-mcp-server && npm install && npm run build
cd ../instagram-mcp-server && npm install && npm run build
```

## YouTube

Tek gereken bir YouTube Data API v3 anahtarı:

```bash
export YOUTUBE_API_KEY="AIza..."   # 39 karakter
```

Anahtarı Google Cloud Console'dan al: proje seç → **YouTube Data API v3**'ü
etkinleştir → Credentials → Create credentials → API key. Sonra
**Restrict key → YouTube Data API v3** uygula; kısıtsız anahtar sızarsa
projedeki tüm etkin API'lerde kullanılabilir.

Doğrulama:

```bash
cd mcp-servers/youtube-mcp-server && YOUTUBE_API_KEY=$YOUTUBE_API_KEY node test/smoke.mjs
```

Sekiz araç: arama, video detayı, trendler, kanal, kanal videoları, playlist,
yorumlar, altyazı listesi. Kota günlük 10.000 birim — arama 100, diğerleri
1 birim. Ayrıntı ve tasarım gerekçeleri sunucunun README'sinde.

**Transcript aracı yok, bilerek.** Sahibi olmadığın videoların altyazı *metni*
bu sunucuyla alınamıyor; iki yol da canlı olarak test edildi ve ikisi de kapalı:

- `captions.download` API anahtarını reddediyor (HTTP 401, *"Expected OAuth2
  access token ... that assert a principal"*). OAuth eklesek bile bu uç metni
  yalnızca videonun sahibine verir.
- İzleme sayfasındaki altyazı URL'i artık **HTTP 200 + 0 bayt** dönüyor —
  YouTube gerçek bir oynatıcı oturumuna bağlı proof-of-origin token istiyor.

Önce bu ikinci yola dayanan bir `youtube_get_transcript` aracı yazılmıştı; hiç
çalışmadı ve kaldırıldı. Her zaman başarısız olan bir araç, hiç olmamasından
kötüdür. Transcript için: başkasının videosunda tarayıcı oturumu, kendi
videolarında OAuth, ölçekli iş için özel bir transcript servisi.

## Instagram

YouTube'dan çok daha fazla ön koşul var ve hiçbiri kodla çözülmüyor:

1. Instagram **Business veya Creator** hesabı (kişisel hesapta API yok)
2. Hesaba bağlı bir Facebook Sayfası
3. Meta App Dashboard'da kayıtlı bir uygulama
4. Doğru izinlere sahip erişim token'ı
5. Sahibi olmadığın hesaplara hizmet verecekse **App Review**

Sonra:

```bash
export INSTAGRAM_ACCESS_TOKEN="..."
export INSTAGRAM_ACCOUNT_ID="17841..."   # instagram_get_account ile bulunur
```

Hesap ID'sini bilmiyorsan `instagram_get_account` aracını `account_id="me"` ile
çağır; ID'yi döndürür.

**Bu sunucunun Graph API çağrıları canlıya karşı hiç çalıştırılmadı.** Meta'nın
resmi belgelerinden (Graph API v25.0) yazıldı, ama geliştirme ortamı
`graph.instagram.com`'u engelliyor. Protokol katmanı test edildi (25/25):
araç kaydı, şema doğrulama, hata yolları. İlk canlı kullanımı bir duman testi
gibi ele al.

**İki araç herkese açık ve geri alınamaz yazma yapar:** `instagram_publish_post`
ve `instagram_reply_to_comment`. Çağrı başarılı olduğu anda içerik canlı hesapta
görünür ve bu sunucu onu silemez.

Limitler: saatte 200 çağrı, 24 saatte 100 yayın, görseller yalnızca JPEG ve
herkese açık bir URL'de barındırılmalı. Tetikleyici yok — yeni yorum veya DM
geldiğinde oturum kendiliğinden uyanmaz.

## Kapsam ve web oturumları

`.mcp.json` proje kapsamıdır: bu repoda çalışan herkese gelir ve Claude Code ilk
açılışta onay ister. Sadece kendi makinende, tüm projelerde istiyorsan:

```bash
claude mcp add -s user youtube -e YOUTUBE_API_KEY=$YOUTUBE_API_KEY -- \
  node "$PWD/mcp-servers/youtube-mcp-server/dist/index.js"
```

Claude Code'un web sürümü izole, geçici bir container'da çalışır. `.mcp.json`
oradaki oturumda da yüklenir, ancak ortam değişkenleri tanımlı değilse sunucular
kimlik doğrulama hatası döndürür — bu beklenen davranıştır, bozukluk değil.
Web oturumlarında anahtarları environment ayarlarından tanımlaman gerekir.

## Anahtarlar

Hiçbir anahtar repoda tutulmaz. `.mcp.json` hepsini `${VAR}` ile ortamdan okur,
`.gitignore` ise `.env` ve `.env.local` dosyalarını dışarıda bırakır. Bir
anahtarı yanlışlıkla commit ettiysen, geçmişi temizlemek yetmez — sağlayıcıda
döndür (rotate).
