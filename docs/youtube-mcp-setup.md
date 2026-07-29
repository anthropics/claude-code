# YouTube MCP kurulumu

Bu repo, [`youtube-data-mcp-server`](https://www.npmjs.com/package/youtube-data-mcp-server)
paketini proje kapsamında (`project` scope) tanımlayan bir `.mcp.json` içerir.
Sunucu YouTube Data API v3 üzerinden çalışır: video arama, metadata, altyazı,
kanal istatistikleri, trend listesi ve engagement metrikleri.

## API anahtarı

Anahtar **repoya yazılmaz**. `.mcp.json` onu ortamdan okur:

```json
"YOUTUBE_API_KEY": "${YOUTUBE_API_KEY}"
```

Kabuk profiline ekle (`~/.zshrc`, `~/.bashrc` vb.):

```bash
export YOUTUBE_API_KEY="AIza..."
# Varsayılan altyazı dili (opsiyonel, ayarlanmazsa 'en')
export YOUTUBE_TRANSCRIPT_LANG="tr"
```

Yeni bir kabuk aç ya da `source ~/.zshrc` çalıştır, sonra `claude` başlat.
Claude Code proje kapsamlı sunucuyu ilk açılışta onaya sunar — `/mcp` panelinden
ya da açılıştaki istemden onayla.

Anahtarı Google Cloud Console'dan alırsın:

1. Proje oluştur veya seç
2. **YouTube Data API v3**'ü etkinleştir
3. Credentials → Create credentials → API key
4. **Restrict key → YouTube Data API v3** (bunu atlama; kısıtsız anahtar
   sızdığında tüm etkin API'lerde kullanılabilir)

Ücretsiz kota günlük 10.000 birimdir. Arama çağrıları 100 birim, metadata ve
altyazı çağrıları 1 birim harcar — yani günde ~100 arama veya binlerce metadata
sorgusu.

## Doğrulama

Anahtarın geçerli olduğunu MCP'den bağımsız test etmek için:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&type=video&key=$YOUTUBE_API_KEY"
```

`200` beklenir. `403` genelde API'nin etkinleştirilmediğini ya da anahtar
kısıtlamasının çağrıyı engellediğini gösterir.

Sunucunun bağlandığını görmek için:

```bash
claude mcp list
```

## Sunucu araçları

| Araç | Ne yapar |
|------|----------|
| `searchVideos` | Anahtar kelimeyle video arar |
| `getVideoDetails` | Birden çok videonun metadata ve istatistiklerini getirir |
| `getTranscripts` | Altyazıları çeker (çok dilli) |
| `getRelatedVideos` | İlgili videoları listeler |
| `getChannelStatistics` | Kanal abone/görüntülenme/video sayısı |
| `getChannelTopVideos` | Kanalın en çok izlenen videoları |
| `getVideoEngagementRatio` | Etkileşim oranı hesaplar |
| `getTrendingVideos` | Bölge ve kategoriye göre trendler |
| `compareVideos` | Videoları istatistiksel olarak karşılaştırır |

## Kapsam alternatifleri

`.mcp.json` proje kapsamıdır — bu repoda çalışan herkese gelir. Sadece kendi
makinende, tüm projelerde istiyorsan bunun yerine:

```bash
claude mcp add -s user youtube -e YOUTUBE_API_KEY=$YOUTUBE_API_KEY -- npx -y youtube-data-mcp-server
```

## Web oturumları hakkında

Claude Code'un web sürümü (claude.ai/code) izole, geçici bir container'da çalışır.
`.mcp.json` içindeki stdio sunucusu orada da başlatılabilir, ancak
`YOUTUBE_API_KEY` o ortamda tanımlı değilse sunucu anahtarsız açılır ve yalnızca
API key gerektirmeyen çağrılar çalışır. Web oturumlarında anahtarı ortam
değişkeni olarak environment ayarlarından tanımlaman gerekir.

## Instagram

Instagram için bu repoda henüz config yok. Instagram Graph API şunları zorunlu
kılar: Business/Creator hesabı, hesaba bağlı bir Facebook Sayfası, kayıtlı bir
Meta App, OAuth akışı ve yayına çıkacaksa App Review. Kişisel hesaplar için
resmi API yolu yoktur. Limit: kullanıcı başına saatte 200 çağrı. Ayrıca
tetikleyici (trigger) desteği yoktur — yeni yorum veya DM geldiğinde oturum
kendiliğinden uyanmaz.
