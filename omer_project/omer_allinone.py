#!/usr/bin/env python3
"""OMER All-in-One: CLI + Web + Analiz

Kullanım:
  python omer_allinone.py run
  python omer_allinone.py analyze --text "merhaba dünya"
  python omer_allinone.py finance --csv-path transactions.csv
  python omer_allinone.py web

Web UI:
  http://127.0.0.1:5000
"""

import argparse
import csv
import os
import re
import sys
import textwrap
from collections import defaultdict, OrderedDict
from datetime import datetime
from pathlib import Path

# --- ANALYSIS FUNCTIONS ---
WORD_RE = re.compile(r"\b[\w']+\b", re.UNICODE)


def count_syllables(word):
    word = word.lower()
    word = re.sub(r"[^a-zéöüıâîçğş]", "", word)
    if len(word) == 0:
        return 0
    vowels = 'aeiouyâîöüı'
    syllables = 0
    prev_was_vowel = False
    for ch in word:
        now_vowel = ch in vowels
        if now_vowel and not prev_was_vowel:
            syllables += 1
        prev_was_vowel = now_vowel
    if word.endswith('e') and syllables > 1:
        syllables -= 1
    return max(1, syllables)


def flesch_reading_ease(text):
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    num_sentences = max(1, len(sentences))
    words = WORD_RE.findall(text)
    num_words = max(1, len(words))
    syllables = sum(count_syllables(w) for w in words)
    asl = num_words / num_sentences
    asw = syllables / num_words
    return 206.835 - 1.015 * asl - 84.6 * asw


def analyze_text(text, top_n=20):
    lines = text.splitlines()
    words = WORD_RE.findall(text.lower())
    chars = len(text)
    word_freq = defaultdict(int)
    for w in words:
        word_freq[w] += 1
    top = sorted(word_freq.items(), key=lambda x: (-x[1], x[0]))[:top_n]
    avg_word_len = sum(len(w) for w in words) / max(1, len(words))
    fre = flesch_reading_ease(text)
    return {
        'line_count': len(lines),
        'word_count': len(words),
        'char_count': chars,
        'avg_word_length': avg_word_len,
        'top_words': top,
        'flesch_reading_ease': fre,
    }


def format_text_report(res):
    lines = [
        '--- Metin Analiz Raporu ---',
        f"Satır sayısı: {res['line_count']}",
        f"Kelime sayısı: {res['word_count']}",
        f"Karakter sayısı: {res['char_count']}",
        f"Ortalama kelime uzunluğu: {res['avg_word_length']:.2f}",
        f"Flesch Read. Ease: {res['flesch_reading_ease']:.1f}",
        '\nEn sık kelimeler:',
    ]
    for i, (w, c) in enumerate(res['top_words'], start=1):
        lines.append(f" {i:2d}. {w} ({c})")
    return '\n'.join(lines)


# --- FINANCE FUNCTIONS ---

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
            rows.append({'date': date, 'desc': r.get('description', '').strip(), 'category': r.get('category', 'Unknown').strip(), 'amount': amount})
    return rows


def monthly_flow(transactions):
    monthly = OrderedDict()
    for tx in sorted(transactions, key=lambda x: x['date']):
        key = tx['date'].strftime('%Y-%m')
        monthly.setdefault(key, 0)
        monthly[key] += tx['amount']
    return monthly


def analyze_finance(transactions):
    total_income = sum(tx['amount'] for tx in transactions if tx['amount'] > 0)
    total_expenses = sum(-tx['amount'] for tx in transactions if tx['amount'] < 0)
    net = total_income - total_expenses
    by_category = defaultdict(float)
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


def format_finance_report(report, top_category=5):
    lines = [
        '--- Finansal Analiz Raporu ---',
        f"Toplam Gelir   : {report['total_income']:.2f}",
        f"Toplam Gider   : {report['total_expenses']:.2f}",
        f"Net Bilanço    : {report['net']:.2f}",
        f"Kar Marjı      : {report['profit_margin']:.2f}%",
        f"Gider Oranı    : {report['expense_ratio']:.2f}%",
        '\nKategori Dağılımı:',
    ]
    sorted_cat = sorted(report['by_category'].items(), key=lambda x: -abs(x[1]))
    for k, v in sorted_cat:
        lines.append(f" - {k:20s}: {v:+.2f}")
    if top_category > 0:
        lines.append(f"\nEn Çok Kategori (ilk {top_category}):")
        for i, (k, v) in enumerate(sorted_cat[:top_category], start=1):
            lines.append(f" {i:2d}. {k:20s}: {v:+.2f}")
    lines.append('\nAylık Nakit Akışı:')
    for m, v in report['monthly_flow'].items():
        lines.append(f" - {m}: {v:+.2f}")
    return '\n'.join(lines)


def format_dashboard(report):
    view = [
        '\n--- Dashboard ---',
        f"Net: {report['net']:.2f} | Gelir: {report['total_income']:.2f} | Gider: {report['total_expenses']:.2f}",
        f"Kar marjı: {report['profit_margin']:.2f}% | Gider oranı: {report['expense_ratio']:.2f}%",
        'Aylık akış:'
    ]
    flow = list(report['monthly_flow'].values())
    if flow:
        minv, maxv = min(flow), max(flow)
        span = max(1, maxv - minv)
        for m, v in report['monthly_flow'].items():
            bar = '▇' * max(1, int((v - minv) / span * 20))
            view.append(f" {m}: {v:+.2f} {bar}")
    return '\n'.join(view)


# --- COMMANDS ---

def command_run():
    print(textwrap.dedent('''
    OMER All-in-One kontrol scripti
    Kullanım:
      python omer_allinone.py run
      python omer_allinone.py analyze --text "metin"
      python omer_allinone.py finance --csv-path transactions.csv
      python omer_allinone.py web
    '''))


def command_analyze(text):
    res = analyze_text(text)
    print(format_text_report(res))


def command_finance(csv_path, top_category=5, dashboard=False, save=None):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(csv_path)
    txs = parse_csv(csv_path)
    if not txs:
        print('Veri yok veya geçersiz format')
        return
    report = analyze_finance(txs)
    output = format_finance_report(report, top_category=top_category)
    if dashboard:
        output += '\n' + format_dashboard(report)
    print(output)
    if save:
        Path(save).write_text(output, encoding='utf-8')
        print(f'Rapor kaydedildi: {save}')


def command_web():
    try:
        from flask import Flask, render_template, request, redirect, url_for, flash
    except ModuleNotFoundError:
        print('Flask yüklü değil. pip install flask')
        return

    app = Flask(__name__)
    app.secret_key = 'omer-secret'
    base = Path(__file__).resolve().parent

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/analyze', methods=['POST'])
    def analyze_form():
        text = request.form.get('text', '').strip()
        if not text:
            flash('Lütfen metin girin', 'error')
            return redirect(url_for('index'))
        res = analyze_text(text)
        return render_template('analysis.html', output=format_text_report(res))

    @app.route('/finance', methods=['POST'])
    def finance_form():
        csv_text = request.form.get('csv', '').strip()
        if not csv_text:
            flash('Lütfen CSV girin', 'error')
            return redirect(url_for('index'))
        csv_path = base / 'tmp_finance.csv'
        csv_path.write_text(csv_text, encoding='utf-8')
        txs = parse_csv(str(csv_path))
        report = analyze_finance(txs)
        out = format_finance_report(report, top_category=5) + '\n' + format_dashboard(report)
        return render_template('analysis.html', output=out)

    app.run(debug=True, host='127.0.0.1', port=5000)


def main():
    parser = argparse.ArgumentParser(description='OMER All-in-One')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('run', help='Rehber')
    a = sub.add_parser('analyze', help='Metin analiz')
    a.add_argument('--text', required=True)
    f = sub.add_parser('finance', help='Finansal analiz')
    f.add_argument('--csv-path', required=True)
    f.add_argument('--top-category', type=int, default=5)
    f.add_argument('--dashboard', action='store_true')
    f.add_argument('--save')
    sub.add_parser('web', help='Web UI')
    args = parser.parse_args()

    if args.command == 'run':
        command_run()
    elif args.command == 'analyze':
        command_analyze(args.text)
    elif args.command == 'finance':
        command_finance(args.csv_path, top_category=args.top_category, dashboard=args.dashboard, save=args.save)
    elif args.command == 'web':
        command_web()


if __name__ == '__main__':
    main()
