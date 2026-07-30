# MCP sunucuları

Bu repo iki MCP sunucusu içerir — biri YouTube, biri Instagram. Instagram
sunucusu üç ayrı hesap için üç kez çalışıyor, aynı derlemeyle. Hepsi TypeScript,
stdio üzerinden ve `.mcp.json` ile proje kapsamında tanımlı.

| Sunucu | Durum | Kaynak |
|---|---|---|
| `youtube` | Canlı API'ye karşı test edildi (smoke 13/13, ayrıştırıcı 14/14, OAuth transcript elle doğrulandı) | `mcp-servers/youtube-mcp-server/` |
| `instagram` | Okuma araçları canlı hesapta doğrulandı; story yayınlama da | `mcp-servers/instagram-mcp-server/` |
| `instagram-alt` | Aynı sunucu, ikinci hesap için ayrı kimlik bilgileriyle | `mcp-servers/instagram-mcp-server/` |
| `instagram-fizik` | Aynı sunucu, üçüncü hesap | `mcp-servers/instagram-mcp-server/` |

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

Dokuz araç: arama, video detayı, trendler, kanal, kanal videoları, playlist,
yorumlar, altyazı listesi, transcript. Kota günlük 10.000 birim — arama 100,
diğerleri 1 birim. Ayrıntı ve tasarım gerekçeleri sunucunun README'sinde.

**Transcript herkese açık her videoda çalışıyor**, ama iki farklı yoldan.
Öncelikli yol `yt-dlp` — kota harcamıyor, herhangi bir videoyu okuyor, ama
PATH'te `yt-dlp` ve bir JS runtime gerektiriyor (`brew install yt-dlp` ikisini
birden kuruyor). Yedek yol OAuth'lu `captions.download`, o da yalnızca kendi
yüklediğin videolarda çalışıyor çünkü uç kimlik doğrulamaya değil sahipliğe
bakıyor. Yanıttaki `source` alanı hangisinin cevapladığını söylüyor.

yt-dlp yolu YouTube'un bot challenge'ını çözerek çalışıyor; YouTube o mekanizmayı
değiştirdiğinde yt-dlp güncellenene kadar araç durur. Ayrıca Data API'nin
şartları dışında kalıyor — kişisel kullanımda pratik bir mesele değil, ama
paylaşılan bir kurulumda bilerek karar vermek gerekir.

### OAuth kurulumu (yedek yol)

Kurulum: Google Cloud Console'da **Credentials → OAuth client ID → Desktop app**
oluştur, sonra sunucu dizininde:

```bash
node scripts/authorize.mjs
```

Tarayıcıda onay sayfasını açar, loopback portundan yanıtı yakalar ve üç export
basar. Scope `youtube.force-ssl`. Consent screen **Testing** modundaysa refresh
token 7 günde bir dolar — uygulamayı yayınlarsan uzun ömürlü olur.

Bu değişkenler yoksa transcript aracı yt-dlp yoluna düşer; diğer sekiz araç
etkilenmez. OAuth yalnızca yt-dlp yoksa ve video senin kendi yüklediğinse devreye
giriyor.

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

### Çoklu hesap

Aynı derleme, ayrı kimlik bilgileriyle ek sunucu olarak çalışır — kodda çoklu
hesap desteğine gerek yok, çünkü araçlar sunucu adıyla ayrışıyor. Hangi sunucu
hangi hesap:

| Sunucu | Ortam değişkeni öneki |
|---|---|
| `instagram` | `INSTAGRAM_` |
| `instagram-alt` | `INSTAGRAM_ALT_` |
| `instagram-fizik` | `INSTAGRAM_FIZIK_` |

```bash
export INSTAGRAM_ALT_ACCESS_TOKEN="..."
export INSTAGRAM_ALT_ACCOUNT_ID="..."
export INSTAGRAM_FIZIK_ACCESS_TOKEN="..."
export INSTAGRAM_FIZIK_ACCOUNT_ID="..."
```

Her sunucu dokuz araç kaydettiği için üç hesap 27 Instagram aracı demek. Aktif
kullanmadığın bir hesabı `.mcp.json`'dan geçici olarak çıkarmak oturumdaki araç
listesini kısaltır.

Token'ı almak için `authorize.mjs` akışını **gizli sekmede** çalıştır ve o hesapla
giriş yap; normal sekmede tarayıcı mevcut oturumu kullanır ve yanlış hesabı
yetkilendirir. Script çıktısındaki `account:` satırı hangi hesabın bağlandığını
söylüyor — devam etmeden önce ona bak.

**Okuma araçlarının tamamı canlı bir Instagram professional hesabına karşı
doğrulandı:** hesap profili, medya listesi (cursor sayfalama, carousel/reel
ayrımı), tekil gönderi, post ve hesap insights, yayınlama limiti, yorumlar.
Protokol katmanı ayrıca 25/25 geçiyor.

`instagram_publish_post` **görsel story için doğrulandı** — container, durum
kontrolü, yayınlama ve permalink zinciri canlı hesapta çalıştı. Video/reel'in
gerektirdiği asenkron transcode beklemesi ve feed gönderileri henüz denenmedi.
Not: feed 4:5–1.91:1 en-boy aralığı istiyor, story bu kısıtı uygulamıyor.

`instagram_reply_to_comment` **doğrulanmadı** — ve bilerek. Test etmek gerçek bir
insanın yorumunun altına canlı hesapta herkese açık bir yanıt yazmak demek.

Canlı kullanımdan iki not:

**Uygulama Development modundayken canlı veri okunamıyor** ve bunu söyleyen bir
hata da çıkmıyor — yorum ucu HTTP 200 ile boş `data` döndürüyor. Yazma işlemleri
çalışmaya devam ettiği için kurulum yarı bozuk görünüyor ve insan izin sorunu
sanıyor. App Dashboard'daki **Publish** düğmesiyle Live moda geçince aynı çağrı
anında veriyi döndürüyor. Bunu bulmak en pahalı adım oldu.

Insights metrik başlıkları hesabın diline göre yerelleştirilmiş geliyor —
`name` sabit, `title`/`description` değil.

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
