#!/usr/bin/env python3
"""Finansal analiz aracı

Kullanım:
  python finance_analysis.py transactions.csv [--top-category 5] [--save report.txt] [--chart] [--chart-file file.png] [--start YYYY-MM-DD] [--end YYYY-MM-DD]

Beklenen CSV formatı:
  date,description,category,amount
  2026-01-01,Gelir,Maas,10000
  2026-01-03,Market,Gida,-450

Çıktı:
  - toplam gelir, toplam gider, net
  - kategori bazlı toplamlar
  - aylık nakit akışı
  - temel rasyolar (kar marjı, gider oranı)
  - (opsiyonel) grafik ve rapor kaydı
"""

import argparse
import csv
import os
import sys
from collections import defaultdict, OrderedDict
from datetime import datetime


def parse_csv(path):
    rows = []
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if not r.get('date') or not r.get('amount'):
                continue
            try:
                date = datetime.strptime(r['date'].strip(), '%Y-%m-%d')
                amount = float(r['amount'])
            except Exception:
                continue
            rows.append({
                'date': date,
                'desc': r.get('description', '').strip(),
                'category': r.get('category', 'Unknown').strip(),
                'amount': amount,
            })
    return rows


def filter_transactions(transactions, start=None, end=None):
    if start:
        start_date = datetime.strptime(start, '%Y-%m-%d')
        transactions = [tx for tx in transactions if tx['date'] >= start_date]
    if end:
        end_date = datetime.strptime(end, '%Y-%m-%d')
        transactions = [tx for tx in transactions if tx['date'] <= end_date]
    return transactions


def monthly_flow(transactions):
    monthly = OrderedDict()
    for tx in sorted(transactions, key=lambda x: x['date']):
        key = tx['date'].strftime('%Y-%m')
        monthly.setdefault(key, 0)
        monthly[key] += tx['amount']
    return monthly


def analyze(transactions):
    total_income = sum(tx['amount'] for tx in transactions if tx['amount'] > 0)
    total_expenses = sum(-tx['amount'] for tx in transactions if tx['amount'] < 0)
    net = total_income - total_expenses

    by_category = defaultdict(lambda: 0.0)
    for tx in transactions:
        by_category[tx['category']] += tx['amount']

    monthly = monthly_flow(transactions)

    profit_margin = (net / total_income * 100) if total_income > 0 else 0
    expense_ratio = (total_expenses / total_income * 100) if total_income > 0 else 0

    return {
        'total_income': total_income,
        'total_expenses': total_expenses,
        'net': net,
        'by_category': by_category,
        'monthly_flow': monthly,
        'profit_margin': profit_margin,
        'expense_ratio': expense_ratio,
    }


def print_report(report, top_category=0, save=None):
    lines = []
    lines.append('--- Finansal Analiz Raporu ---')
    lines.append(f"Toplam Gelir   : {report['total_income']:.2f}")
    lines.append(f"Toplam Gider   : {report['total_expenses']:.2f}")
    lines.append(f"Net Bilanço    : {report['net']:.2f}")
    lines.append(f"Kar Marjı      : {report['profit_margin']:.2f}%")
    lines.append(f"Gider Oranı    : {report['expense_ratio']:.2f}%")
    lines.append('\nKategori Dağılımı:')

    sorted_cat = sorted(report['by_category'].items(), key=lambda x: -abs(x[1]))
    for k, v in sorted_cat:
        lines.append(f" - {k:20s}: {v:+.2f}")

    if top_category > 0:
        lines.append(f"\nEn Çok Harcama/Kazanç Kategorileri (ilk {top_category}):")
        for i, (k, v) in enumerate(sorted_cat[:top_category], start=1):
            lines.append(f"  {i:2d}. {k:20s}: {v:+.2f}")

    lines.append('\nAylık Nakit Akışı:')
    for m, v in report['monthly_flow'].items():
        lines.append(f" - {m}: {v:+.2f}")

    output = '\n'.join(lines)
    print(output)

    if save:
        with open(save, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"Rapor kaydedildi: {save}")


def print_dashboard(report):
    print('\n--- Finansal Dashboard ---')
    print(f"Toplam Gelir   : {report['total_income']:.2f}")
    print(f"Toplam Gider   : {report['total_expenses']:.2f}")
    print(f"Net Bilanço    : {report['net']:.2f}")
    print(f"Kar Marjı      : {report['profit_margin']:.2f}%")
    print(f"Gider Oranı    : {report['expense_ratio']:.2f}%")

    # Basit çizgi grafik (metin tabanlı)
    flow = list(report['monthly_flow'].values())
    if flow:
        minv, maxv = min(flow), max(flow)
        rangev = maxv - minv if maxv != minv else 1
        bars = []
        for v in flow:
            norm = int((v - minv) / rangev * 20)
            bars.append('▇' * max(1, norm))

        print('\nAylık Nakit Akışı (basit ASCII):')
        for month, v, bar in zip(report['monthly_flow'].keys(), flow, bars):
            print(f" {month}: {v:+.2f} {bar}")


def plot_chart(report, output_path=None):
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print('matplotlib yüklü değil. `pip install matplotlib` komutuyla yükleyin.')
        return

    labels = list(report['monthly_flow'].keys())
    values = list(report['monthly_flow'].values())

    plt.figure(figsize=(10, 5))
    plt.plot(labels, values, marker='o')
    plt.title('Aylık Nakit Akışı')
    plt.xlabel('Ay')
    plt.ylabel('Miktar')
    plt.grid(True)
    plt.xticks(rotation=45)
    plt.tight_layout()

    if output_path:
        plt.savefig(output_path)
        print(f'Grafik kaydedildi: {output_path}')
    else:
        plt.show()


def main():
    parser = argparse.ArgumentParser(description='Gelişmiş finansal analiz programı')
    parser.add_argument('path', help='CSV dosya yolu')
    parser.add_argument('--top-category', type=int, default=0, help='En çok harcama/kazanç kategorisi sayısı')
    parser.add_argument('--save', help='Raporu bu dosyaya kaydet')
    parser.add_argument('--chart', action='store_true', help='Aylık nakit akışı grafiğini göster veya kaydet')
    parser.add_argument('--chart-file', help='Grafiği bu dosyaya kaydet (varsayılan ekran)')
    parser.add_argument('--dashboard', action='store_true', help='Metin tabanlı dashboard göster')
    parser.add_argument('--start', help='Başlangıç tarihi (YYYY-MM-DD)')
    parser.add_argument('--end', help='Bitiş tarihi (YYYY-MM-DD)')
    args = parser.parse_args()

    if not os.path.exists(args.path):
        print(f"Dosya bulunamadı: {args.path}")
        sys.exit(1)

    txs = parse_csv(args.path)
    if not txs:
        print('Veri bulunamadı veya geçersiz format.')
        return

    txs = filter_transactions(txs, start=args.start, end=args.end)
    if not txs:
        print('Verilen tarih aralığında işlem bulunamadı.')
        return

    report = analyze(txs)
    print_report(report, top_category=args.top_category, save=args.save)

    if args.dashboard:
        print_dashboard(report)

    if args.chart:
        plot_chart(report, output_path=args.chart_file)


if __name__ == '__main__':
    main()
