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
# 2) Argümansız çalıştır — hiçbir şey yazmadan:
#
#      ./indir.sh
#
#    Önce bu klasöre, sonra bir üstündeki gönderi klasörüne bakar: dosyaları
#    ikisinden birine attıysan, adları ne olursa olsun ada göre sıralayıp
#    clarke/devoret/martinis yapar. İkisinde de yoksa ~/Downloads ve ~/Desktop
#    içinde adında soyisim geçen görselleri arar.
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

img_args=(-iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.avif')

# --- Mod 2: dosyalar zaten bu klasörde --------------------------------------
#
# Argümansız çalıştırıldığında ilk bakılan yer burası. Kullanıcı dosyaları
# kendisi buraya attıysa yapacak iş sadece isimlendirme — dışarıda aramanın
# anlamı yok. Hedef isimlerden farklı adı olan görseller "yabancı" sayılıyor.

if [ "$#" -eq 0 ]; then
  # Hem bu klasör hem bir üstü (gönderi klasörü) taranıyor: dosyaları
  # content/trakyafizik/ altına bırakmak en az photos/ altına bırakmak kadar
  # doğal, ve ikisi arasındaki farkı kullanıcıya ödetmenin anlamı yok.
  strays=""
  found_in=""
  for scan in "$dest" "$(cd "$dest/.." && pwd)"; do
    hit=$(find "$scan" -maxdepth 1 -type f \( "${img_args[@]}" \) 2>/dev/null \
      | grep -Ev '/(clarke|devoret|martinis)\.jpg$' | sort)
    if [ -n "$hit" ]; then
      strays="$hit"
      found_in="$scan"
      break
    fi
  done

  if [ -n "$strays" ]; then
    count=$(printf '%s\n' "$strays" | wc -l | tr -d ' ')
    if [ "$count" -gt 3 ]; then
      echo "$found_in içinde $count görsel var, hangisinin hangisi olduğu belirsiz:" >&2
      printf '%s\n' "$strays" | sed "s|$found_in/|  |" >&2
      echo >&2
      echo "Üç tanesini sırayla vererek çalıştır, örneğin:" >&2
      printf '  ./indir.sh' >&2
      printf '%s\n' "$strays" | head -3 | while IFS= read -r s; do
        printf ' %s' "$(basename "$s")" >&2
      done
      echo >&2
      exit 1
    fi

    echo "Dosyalar bulundu: $found_in"

    # eslesme.txt varsa sıralamaya hiç güvenilmiyor. Dosya adları sayısal
    # sırada olabilir ama kişiler o sırada değil — bir kez yanlış atama bu
    # yüzden oldu. Doğrulanmış bilgi dosyada duruyor, her seferinde yeniden
    # türetilmiyor.
    map_file="$dest/eslesme.txt"
    used_map=0

    if [ -f "$map_file" ]; then
      resolved=""
      for target in "${names[@]}"; do
        token=$(awk -v n="$target" '$1 == n && $1 !~ /^#/ { print $2; exit }' "$map_file")
        hit=""
        [ -n "$token" ] && hit=$(printf '%s\n' "$strays" | grep -F -- "$token" | head -1)
        [ -z "$hit" ] && { resolved=""; break; }
        resolved="$resolved$target|$hit"$'\n'
      done

      if [ -n "$resolved" ]; then
        echo "Eşleşme eslesme.txt'den okundu (dosya sırasına bakılmadı):"
        echo
        printf '%s' "$resolved" | while IFS='|' read -r target src; do
          [ -z "$target" ] && continue
          cp "$src" "$dest/$target.jpg"
          echo "✓ $target.jpg  ←  $(basename "$src")"
        done
        used_map=1
      else
        echo "eslesme.txt var ama dosya adlarıyla eşleşmedi; ada göre sıralanıyor."
      fi
    fi

    if [ "$used_map" -eq 0 ]; then
      echo "Ada göre sıralanıp isimlendiriliyor — SIRA DOĞRULANMADI, render'da"
      echo "yüzleri isimlerle karşılaştır:"
      echo
      i=0
      while IFS= read -r src; do
        cp "$src" "$dest/${names[$i]}.jpg"
        echo "✓ ${names[$i]}.jpg  ←  $(basename "$src")"
        i=$((i + 1))
      done <<< "$strays"
    fi

    echo
    if [ "$used_map" -eq 1 ]; then
      echo "Eşleşme yanlışsa eslesme.txt'yi düzelt — orada tek satır değiştirmek"
      echo "yeterli, bir daha uğraşmak gerekmiyor."
    else
      echo "Sıra yanlışsa üçünü istediğin sırayla ver:"
      printf '  ./indir.sh'
      while IFS= read -r src; do printf ' %s' "$src"; done <<< "$strays"
      echo
    fi
    echo
    echo "Sonra:  node ../../render.mjs ../nobel-2025.html"
    exit 0
  fi
fi

# --- Mod 3: ada göre ara ------------------------------------------------------

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
