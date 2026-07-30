#!/usr/bin/env bash
#
# İndirdiğin portreleri bu klasöre doğru isimlerle kopyalar. İki mod var.
#
# 1) Sırayla ver — dosya adı hiç önemli değil, en garantili yol:
#
#      ./indir.sh ~/Downloads/foto1.jpg ~/Downloads/foto2.jpg ~/Downloads/foto3.jpg
#
#    Sırasıyla clarke, devoret, martinis olur. Hangisinin hangisi olduğunu
#    ekrana basar; yanlışsa iki dosyanın adını takas etmek yeterli.
#
# 2) Ada göre ara — dosya adında soyisim geçiyorsa:
#
#      ./indir.sh                    # ~/Downloads ve ~/Desktop içinde arar
#      ./indir.sh ~/başka/klasör
#
# Uzantı önemli değil (.jpg .jpeg .png .webp .avif); .jpg olarak kopyalanıyor,
# tarayıcı görsel türünü içerikten anlıyor.
#
# pipefail bilinçli olarak kapalı: `find | head -1` erken kapanan boruya
# SIGPIPE yolluyor ve pipefail açıkken script orada ölüyor.
set -eu

dest="$(cd "$(dirname "$0")" && pwd)"
names=(clarke devoret martinis)

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
}

# --- Mod 1: dosyalar sırayla verilmiş -----------------------------------------

if [ "$#" -gt 0 ] && [ -f "$1" ]; then
  if [ "$#" -gt 3 ]; then
    echo "En fazla üç dosya verilebilir, $# verildi." >&2
    exit 1
  fi

  i=0
  for src in "$@"; do
    if [ ! -f "$src" ]; then
      echo "Dosya yok: $src" >&2
      exit 1
    fi
    cp "$src" "$dest/${names[$i]}.jpg"
    echo "✓ ${names[$i]}  ←  $(basename "$src")"
    i=$((i + 1))
  done

  echo
  echo "Sıra yanlışsa dosyaları farklı sırayla tekrar ver."
  echo "Sonra:  node ../../render.mjs ../nobel-2025.html"
  exit 0
fi

# --- Mod 2: ada göre ara ------------------------------------------------------

if [ "$#" -gt 0 ]; then
  dirs=("$1")
  if [ ! -d "$1" ]; then
    echo "Klasör ya da dosya değil: $1" >&2
    echo
    usage
    exit 1
  fi
else
  dirs=("$HOME/Downloads" "$HOME/Desktop")
fi

img_args=(-iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.avif')

copied=0
for name in "${names[@]}"; do
  match=""
  for dir in "${dirs[@]}"; do
    [ -d "$dir" ] || continue
    match=$(find "$dir" -maxdepth 1 -type f -iname "*${name}*" \( "${img_args[@]}" \) 2>/dev/null | head -1)
    [ -n "$match" ] && break
  done

  if [ -n "$match" ]; then
    cp "$match" "$dest/$name.jpg"
    echo "✓ $name  ←  $(basename "$match")"
    copied=$((copied + 1))
  else
    echo "✗ $name  —  adında '$name' geçen görsel bulunamadı"
  fi
done

echo
echo "$copied/3 kopyalandı."

if [ "$copied" -lt 3 ]; then
  echo
  echo "Dosya adları soyisim içermiyor. En kolayı sırayla vermek:"
  echo
  echo "  ./indir.sh dosya1 dosya2 dosya3     # clarke, devoret, martinis"
  echo
  echo "Aranan klasörlerdeki son görseller:"
  for dir in "${dirs[@]}"; do
    [ -d "$dir" ] || continue
    found=$(find "$dir" -maxdepth 1 -type f \( "${img_args[@]}" \) 2>/dev/null | head -12)
    if [ -n "$found" ]; then
      echo "  $dir:"
      echo "$found" | sed "s|$dir/|    |"
    fi
  done
fi

echo
echo "Sonra:  node ../../render.mjs ../nobel-2025.html"
