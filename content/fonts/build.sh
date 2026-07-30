#!/usr/bin/env bash
#
# DejaVu'nun dört yüzünü Türkçe + Batı Avrupa karakterlerine indirip woff2'ye
# çevirir. Çıktı bu klasöre yazılır ve repoya commit'lenir.
#
#   ./build.sh
#
# Neden repoda font var: aynı HTML her makinede aynı görseli üretmeli. Sistem
# fontuna güvenmek işe yaramıyor — macOS'ta DejaVu yok, Georgia'ya düşüyor ve
# satır sonları benim ölçtüğüm yerden kayıyor. Ayrıca DejaVu Serif'in italik
# yüzü hiç yok; tarayıcı eğerek uyduruyor, macOS'ta ise gerçek Georgia Italic
# çıkıyor. Aynı dosya iki farklı görsel demek.
#
# Gerekli: pip install fonttools brotli
set -eu

cd "$(dirname "$0")"

SRC=/usr/share/fonts/truetype/dejavu
if [ ! -d "$SRC" ]; then
  echo "DejaVu kaynak fontları yok: $SRC" >&2
  echo "Debian/Ubuntu: apt install fonts-dejavu-core" >&2
  exit 1
fi

# Latin temel + Latin-1 + Türkçe (Ğğİıv Şş) + kullanılan tipografik işaretler.
# Kapsamı geniş tutmak sonraki gönderilerde eksik glif sürprizini önlüyor;
# maliyeti yüz başına birkaç KB.
UNICODES='U+0020-007E,U+00A0-00FF,U+0100-017F,U+018F,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2030,U+2039-203A,U+2044,U+2192,U+2212,U+2248,U+2260,U+00B0,U+00B7,U+00A9,U+00AE,U+2122'

build() {
  local src="$1" out="$2"
  pyftsubset "$SRC/$src" \
    --output-file="$out" \
    --flavor=woff2 \
    --unicodes="$UNICODES" \
    --layout-features='kern,liga,tnum,onum' \
    --no-hinting \
    --desubroutinize
  printf '  %-26s %6s KB\n' "$out" "$(( ($(stat -c%s "$out" 2>/dev/null || stat -f%z "$out") + 512) / 1024 ))"
}

echo "woff2 altkümeleri:"
build DejaVuSans.ttf        dejavu-sans.woff2
build DejaVuSans-Bold.ttf   dejavu-sans-bold.woff2
build DejaVuSerif.ttf       dejavu-serif.woff2
build DejaVuSerif-Bold.ttf  dejavu-serif-bold.woff2

echo
echo "Toplam: $(du -ch ./*.woff2 | tail -1 | cut -f1)"
