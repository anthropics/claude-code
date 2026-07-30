# Görsel şablonlar

Instagram gönderileri için sabit tuvalli HTML şablonları. Her dosya bir gönderi;
her sayfa (`.slide`) bir kare. `render.mjs` sayfaları tek tek PNG'ye çeviriyor.

```bash
node render.mjs trakyafizik/nobel-2025.html      # -> out/nobel-2025-01.png ...
node render.mjs mindsetblunt/reel-covers.html
node render.mjs trakyafizik/nobel-2025.html --scale 2   # 2x çözünürlük
```

`playwright` global kurulu olsa da çalışıyor; script bulamazsa `npm root -g`
üzerinden kendisi çözüyor. Chromium'u indirmeye çalışmaz.

| Dosya | Hesap | Ölçü | Sayfa |
|---|---|---|---|
| `trakyafizik/nobel-2025.html` | @trakyafizik | 1080×1350 (4:5) | 5 |
| `mindsetblunt/reel-covers.html` | @mindsetblunt | 1080×1920 (9:16) | 5 |

## Neden HTML

Tasarım metinden ayrı bir yerde durmuyor — kaynak dosya hem tasarım hem içerik.
Bir sonraki fizik gönderisi için dosyayı kopyalayıp metni değiştirmek yeterli,
görünüm kendiliğinden aynı kalıyor:

```bash
cp trakyafizik/nobel-2025.html trakyafizik/juno-sonucu.html
# metinleri değiştir
node render.mjs trakyafizik/juno-sonucu.html
```

Aynı dosyalar Adobe Express'e de aktarılabiliyor (`hz:slide-selector` ve
`data-canvas-*` metadata'sı bunun için duruyor), ama günlük kullanım PNG.

## Sayfa tipleri — @trakyafizik

`.s-title` başlık · `.s-people` kişi kartları · `.s-explainer` açık zeminli
anlatım · `.s-statement` tek cümle · `.s-closing` kapanış.

Renkler, tipografi ve kenar boşlukları `:root` altındaki değişkenlerde. Orada
bir değeri değiştirmek beş sayfaya birden işliyor — hesabın görsel kimliği
tek yerden yönetiliyor.

### Türkçe büyük harf

Her `.slide` üzerinde `lang="tr"` var. Bu olmadan `text-transform: uppercase`
"fizik"i **FIZIK** yapıyor; `lang="tr"` ile **FİZİK** oluyor. Yeni sayfa
eklerken bu attribute'u kopyalamayı atlamayın.

### Terimler

Çeviriler literatür karşılıklarıyla yazıldı, birebir çeviriyle değil:

| İngilizce | Kullanılan | Kullanılmayan |
|---|---|---|
| quantisation | kuantumlanma | ~~kuantalanma~~, ~~nicemlenme~~ |
| energy level | enerji düzeyi | ~~enerji seviyesi~~ |
| potential barrier | potansiyel bariyer | ~~engel~~ |
| transmitted wave | iletilen dalga | ~~geçen dalga~~ |
| discrete | kesikli | — |
| tunnelling | tünelleme / tünellemesi | — |

Ölçüt "Türkçesi en arı olan" değil, **Türk fizik bölümlerinin kendi ders
materyallerinde geçen** karşılık. `nicemlenme` gerçek bir TDK terimi ve
dilbilgisi olarak doğru (edilgen çatı, enerjinin kendi özelliği için doğrusu),
ama üniversite notlarında `kuantumlanmış` ve `kuantizasyon` kullanılıyor —
Çukurova'nın kuantum laboratuvarı notları "enerji düzeyleri kuantumlanmış",
Boğaziçi'nin ders tanımları "enerjinin kuantizasyonu" diyor. Birebir çeviri ile
özleştirme aynı hatanın iki yönü: ikisi de literatürün fiilen ne kullandığını
sormuyor.

Bölümün kendi ders dilinde farklı bir tercih varsa o kazanır — iki dosyada
üç kelime, `kuantumlanma` yerine ne kullanıyorsanız onu yazın.

Nobel gerekçesinin İngilizce özgün hâli 2. sayfada küçük puntoyla duruyor:
çeviri bir terim tercihi içeriyor ve o tercihi gizlemek yerine yanına
koymak daha doğru.

### Portreler

`nobel-2025.html` 2. sayfada üç portre yuvası var:

```
trakyafizik/photos/clarke.jpg
trakyafizik/photos/devoret.jpg
trakyafizik/photos/martinis.jpg
```

Dosya yoksa çerçeve baş harfleri gösteriyor — tasarım bozulmuyor. Fotoğrafları
koyup yeniden render alınca kendiliğinden yerine oturuyorlar.

Fotoğraflar bu depoya girmiyor (`.gitignore`), çünkü telifleri başkasına ait.
Resmî portreler `nobelprize.org/prizes/physics/2025/<soyisim>/facts/`
sayfalarında. Nobel Vakfı 2007 sonrası resmî portrelerin **kesinlikle editoryal
kullanımını** ücretsiz veriyor, koşulu: telif satırı **ve** fotoğrafçının adı.
Sayfadaki krediyi olduğu gibi 2. sayfadaki `.credit` satırına yazın:

```html
<p class="credit">Fotoğraflar: © Nobel Prize Outreach. Fotoğraf: [fotoğrafçı adı]</p>
```

**Niklas Elmehed'in duyuru illüstrasyonlarını kullanmayın.** Onların izni
"duyuru yılının 31 Aralık'ına kadar" ile sınırlı; 2025 ödülü için o izin
31 Aralık 2025'te doldu.

## @mindsetblunt kapakları

Reel'in ilk karesi / kapak görseli. Kasıtlı olarak fizik hesabına hiç
benzemiyor: serif yok, altın yok, süs yok — siyah zemin, kalın sans, tek
turuncu vurgu.

**Güvenli alan:** Reels arayüzü üstte ~120px, altta ~330px kaplıyor. Metin
bloğu alttan sabitli (`.hookblock { bottom: 400px }`), böylece satır sayısı
4'ten 5'e çıktığında yukarı doğru büyüyor ve `@mindsetblunt` satırının üstüne
binmiyor.

Arkadaki soluk sayı (`.ghost`) konuyu tek bakışta veriyor. Boyutu karakter
sayısına göre elle ayarlı — 300px yalnızca 5 karaktere kadar sığıyor, uzun
olanlar sağdan taşar. Yeni kart eklerken sağ kenarı kontrol edin.

## Fontlar

Sistem fontları: gövde **DejaVu Sans**, başlık **DejaVu Serif**. İkisi de
Türkçe'nin tamamını kapsıyor (ı İ ğ ş ç ö ü) ve harici bir istek
gerektirmiyor — dosyalar tek başına, ağ erişimi olmadan render alıyor.
