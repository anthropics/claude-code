# Nobel 2025 carousel — yayın notu

Bu dosya, gönderiyi yayınlayacak yerel oturum için. Web oturumunda yapılamayan
tek şey yayınlamaktı: container'da `graph.instagram.com` kapalı
(`CONNECT tunnel failed, 403`) ve token tanımsız.

## Durum

Beş kare hazır ve doğrulandı: `content/out/nobel-2025-0{1..5}.jpg`

```bash
node content/render.mjs content/trakyafizik/nobel-2025.html --jpeg
```

Bu komut uyarısız çıkmalı. Çıkan uyarılar bir şeyin bozulduğunu söyler:

| Uyarı | Anlamı |
|---|---|
| `UYARI — font sorunu` | `content/fonts/*.woff2` eksik ya da yol bozuk; tipografi sistem fontuna düşmüş |
| `UYARI — N görsel yüklenmedi` | portreler `photos/` altında değil; kartlar yer tutucuyla çıkmış |

**JPEG şart.** Instagram Graph API görsellerde yalnızca JPEG kabul ediyor ve
reddederken biçimden söz etmiyor — container sessizce `ERROR` durumuna düşüyor.
PNG çıktı yalnızca uygulamadan elle paylaşım için.

Ölçü 1080×1350, tam 4:5 — feed'in kabul ettiği alt sınır. Daha önce 0.67
oranlı bir görsel feed'e girmemişti; bu ölçüde o risk yok.

## Yayınlama

Ön koşullar:

```bash
export INSTAGRAM_FIZIK_ACCESS_TOKEN="..."
export INSTAGRAM_FIZIK_ACCOUNT_ID="..."
```

Claude Code'u repo kökünden başlat — `.mcp.json` proje kapsamında oradan
yükleniyor ve `instagram-fizik` sunucusu bu iki değişkeni okuyor.

**Yayınlamadan önce `instagram_get_account` çağır** ve dönen kullanıcı adının
`trakyafizik` olduğunu gör. Token yanlış hesaba bağlıysa anlaşılacağı yer
burası; yayınladıktan sonrası geri alınamıyor.

Sonra beş görseli herkese açık HTTPS URL'lerine koy ve sırayla ver:

```
instagram_publish_carousel
  image_urls: [ ...01.jpg, ...02.jpg, ...03.jpg, ...04.jpg, ...05.jpg ]
  caption:    aşağıdaki metin
```

Barındırma elle yapılacak. `batahanka.wordpress.com` üzerinde WordPress MCP
erişimi kapalı (`wpcom_paid_plan_required`), ayrıca sitenin özel alan adı yok —
`batahanka.com` o siteye bağlı değil. wp-admin'den medya kütüphanesine yüklemek
tarayıcıdan çalışıyor; **doğrudan dosya URL'sini** al, Jetpack'in
`?w=…&allow_lossy=…` eklediği sürümü değil (WebP döndürebiliyor, Instagram
reddeder). URL'yi gizli sekmede açıp gerçekten JPEG indiğini doğrula.

## Caption

```
2025 Nobel Fizik Ödülü, kuantum mekaniğinin yalnızca atomların dünyasına ait
olmadığını gösteren deneylere verildi. Clarke, Devoret ve Martinis, süperiletken
bir elektrik devresinde tünellemeyi ve kesikli enerji düzeylerini ölçtüler —
avucunuza sığacak bir sistemde.

Bu deneyler 1980'lerin ortasında yapıldı. Bugünün süperiletken kübitleri
doğrudan onların üzerine inşa edildi. Temel araştırmanın kaç yıl sonra
teknolojiye dönüştüğüne dair iyi bir örnek.

Fotoğraflar: © Nobel Prize Outreach. Fotoğraf: Clément Morin

#fizik #nobel #kuantum #kuantumbilgisayar #süperiletkenlik #trakyaüniversitesi
```

Telif satırı 2. sayfada da basılı. Nobel Vakfı'nın izni telif satırı **ve**
fotoğrafçının adını şart koşuyor; ikisi de var.

## Bilinmesi gerekenler

`instagram_publish_carousel` **Graph API'ye karşı hiç çalıştırılmadı.** Uçlar
Meta'nın dokümanından; istemci, container beklemesi ve hata eşlemesi doğrulanmış
tek görsel yoluyla paylaşımlı. Protokol testi 30/30 geçiyor ama yalnızca şema ve
yerel yolları kapsıyor, ağı değil.

İlk denemede en olası hatalar, sırayla:

1. **PNG** — `--jpeg` kullanılmamış
2. **Meta'nın erişemediği URL** — tarayıcıda açılan her URL Meta'nın
   sunucusundan açılmıyor
3. **`content_publish` izni** — token'da yok ya da uygulama Live modda değil

Hata hangi item'da olduğunu söylüyor ("item 3 of 5"). Oluşmuş container'lar 24
saat geçerli kalıyor ama araç kaldığı yerden devam etmiyor, baştan başlıyor.

**Başarılı olduğu an gönderi canlı ve API onu silemiyor.** Silmek uygulamadan
elle olur.

Yayın sonrası: portreleri medya kütüphanesinden kaldırmak temiz olur, Instagram
görselleri kendi sunucusuna kopyalıyor. Ve sonucu (çalıştı / hata metni) web
oturumuna yaz — README'deki "doğrulanmadı" notu gerçek duruma çevrilecek.
