#!/usr/bin/env bash
#
# İndirdiğin portreleri bu klasöre doğru isimlerle kopyalar.
#
#   ./indir.sh                  # ~/Downloads içinde arar
#   ./indir.sh ~/Masaüstü       # başka bir klasörde arar
#
# Dosya adında soyismin geçmesi yeterli — "Clarke_postcard.jpg",
# "john-clarke.jpeg", "CLARKE (1).png" hepsi bulunur. Uzantı ne olursa olsun
# .jpg olarak kopyalanıyor; tarayıcı görsel türünü içeriğinden anlıyor, uzantı
# adı önemli değil.
#
# pipefail bilinçli olarak kapalı: `find | head -1` erken kapanan boruya
# SIGPIPE yolluyor ve pipefail açıkken script orada ölüyor.
set -eu

dest="$(cd "$(dirname "$0")" && pwd)"
src="${1:-$HOME/Downloads}"

if [ ! -d "$src" ]; then
  echo "Klasör yok: $src" >&2
  exit 1
fi

copied=0
for name in clarke devoret martinis; do
  match=$(find "$src" -maxdepth 1 -type f -iname "*${name}*" \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
    2>/dev/null | head -1)

  if [ -n "$match" ]; then
    cp "$match" "$dest/$name.jpg"
    echo "✓ $name  ←  $(basename "$match")"
    copied=$((copied + 1))
  else
    echo "✗ $name  —  '$src' içinde adında '$name' geçen görsel yok"
  fi
done

echo
echo "$copied/3 kopyalandı."

if [ "$copied" -lt 3 ]; then
  cat <<EOF

Eksik olanları elle koyabilirsin — beklenen isimler:
  $dest/clarke.jpg
  $dest/devoret.jpg
  $dest/martinis.jpg

'$src' içindeki görseller:
EOF
  find "$src" -maxdepth 1 -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
    -exec basename {} \; 2>/dev/null | head -20 | sed 's/^/  /'
fi

echo
echo "Sonra:  node ../../render.mjs ../nobel-2025.html"
