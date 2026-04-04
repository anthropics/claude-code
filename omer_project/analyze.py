#!/usr/bin/env python3
"""Metin analiz programı

Kullanım:
  python analyze.py sample.txt
  cat sample.txt | python analyze.py

Çıktı:
- Satır, kelime ve karakter sayısı
- En sık geçen kelimeler (ilk 20)
- Ortalama kelime uzunluğu
- Flesch Reading Ease skoru (yaklaşık)
"""

import argparse
import re
import sys

WORD_RE = re.compile(r"\b[\w']+\b", re.UNICODE)


def flesch_reading_ease(text):
    sentences = re.split(r'[.!?]+' , text)
    sentences = [s.strip() for s in sentences if s.strip()]
    num_sentences = max(1, len(sentences))

    words = WORD_RE.findall(text)
    num_words = max(1, len(words))

    syllables = 0
    for w in words:
        syl = count_syllables(w)
        syllables += syl

    asl = num_words / num_sentences
    asw = syllables / num_words

    return 206.835 - 1.015 * asl - 84.6 * asw


def count_syllables(word):
    word = word.lower()
    word = re.sub(r'[^a-zéöüıâîçğş]', '', word)
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


def analyze(text, top_n=20):
    lines = text.splitlines()
    words = WORD_RE.findall(text.lower())
    chars = len(text)

    word_freq = {}
    for w in words:
        word_freq[w] = word_freq.get(w, 0) + 1

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


def main():
    parser = argparse.ArgumentParser(description='Basit metin analiz aracı')
    parser.add_argument('path', nargs='?', help='Analiz edilecek metin dosyası (opsiyonel). Verilmezse stdin kullanılır.')
    parser.add_argument('--top', type=int, default=20, help='En sık geçen kelime sayısı (default 20)')
    args = parser.parse_args()

    if args.path:
        with open(args.path, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
    else:
        text = sys.stdin.read()

    res = analyze(text, top_n=args.top)

    print('--- Metin Analiz Raporu ---')
    print(f"Satır sayısı: {res['line_count']}")
    print(f"Kelime sayısı: {res['word_count']}")
    print(f"Karakter sayısı: {res['char_count']}")
    print(f"Ortalama kelime uzunluğu: {res['avg_word_length']:.2f}")
    print(f"Flesch Reading Ease (tahmini): {res['flesch_reading_ease']:.1f}")
    print('\nEn sık kelimeler:')
    for i, (w, c) in enumerate(res['top_words'], start=1):
        print(f" {i:2d}. {w} ({c})")


if __name__ == '__main__':
    main()
