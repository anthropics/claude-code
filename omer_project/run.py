#!/usr/bin/env python3
"""Ana kontrol scripti:
- run.py (kendi kılavuzu), analyze.py (metin) ve finance_analysis.py (finans) çalıştırma

Kullanım:
  python run.py run
  python run.py analyze sample.txt
  python run.py finance transactions.csv [--top-category 5 --save r.txt --chart --chart-file flow.png --start YYYY-MM-DD --end YYYY-MM-DD]
"""

import argparse
import subprocess
import sys
import textwrap

REHBER = """
1) Problem tanımını netleştir:
   - Ne yazmak istiyorsun?
   - Hangi dil/çerçeve?
   - Hangi giriş/çıkış şartları?

2) Basit bir iskelet oluştur:
   - Python: def main(): ...
   - Node: const main = () => ...
   - HTML/CSS: temel proje yapısı

3) Küçük adımlara böl:
   - Fonksiyon/kütüphane seç
   - Girdi-çıktı örnekleri yaz
   - Test et

4) Çalıştır:
   - python run.py run
   - python run.py analyze sample.txt
   - python run.py finance transactions.csv

5) İyileştir:
   - Linter (pylint/eslint)
   - Otomatik format (black/prettier)
   - Unit test
"""


def user_guide():
    print("=" * 60)
    print("HIZLI KOD YAZMA REHBERİ")
    print("=" * 60)
    print(textwrap.dedent(REHBER).strip())
    print("=" * 60)
    print("Adım 1: `python run.py run` ile kılavuzu görüntüleyin.")
    print("Adım 2: `python run.py analyze <dosya>` veya `python run.py finance <csv>` çalıştırın.")
    print("=" * 60)


def run_subprocess(cmd):
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Hata oluştu (kod {e.returncode}): {e}")
    except FileNotFoundError:
        print(f"Komut bulunamadı: {cmd[0]}")


def main():
    parser = argparse.ArgumentParser(description='OMER Toolkit ana çalıştırıcısı')
    subparsers = parser.add_subparsers(dest='command', required=True)

    subparsers.add_parser('run', help='Run script kılavuzu gösterir')

    anal = subparsers.add_parser('analyze', help='Metin analiz aracını çağırır')
    anal.add_argument('path', help='Analiz edilecek metin dosyası veya stdin')

    fin = subparsers.add_parser('finance', help='Finansal analiz aracını çağırır')
    fin.add_argument('path', help='CSV dosya yolu')
    fin.add_argument('--top-category', type=int, default=0)
    fin.add_argument('--save')
    fin.add_argument('--chart', action='store_true')
    fin.add_argument('--chart-file')
    fin.add_argument('--dashboard', action='store_true')
    fin.add_argument('--start')
    fin.add_argument('--end')

    args, remaining = parser.parse_known_args()

    if args.command == 'run':
        user_guide()

    elif args.command == 'analyze':
        cmd = [sys.executable, 'analyze.py', args.path]
        run_subprocess(cmd)

    elif args.command == 'finance':
        cmd = [sys.executable, 'finance_analysis.py', args.path]
        if args.top_category:
            cmd += ['--top-category', str(args.top_category)]
        if args.save:
            cmd += ['--save', args.save]
        if args.chart:
            cmd.append('--chart')
        if args.chart_file:
            cmd += ['--chart-file', args.chart_file]
        if args.dashboard:
            cmd.append('--dashboard')
        if args.start:
            cmd += ['--start', args.start]
        if args.end:
            cmd += ['--end', args.end]
        run_subprocess(cmd)


if __name__ == '__main__':
    main()
