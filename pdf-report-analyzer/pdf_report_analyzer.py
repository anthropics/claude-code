#!/usr/bin/env python3
"""
PDF Report Analyzer
Analyzes a collection of PDF reports and produces a JSON data file
for visualization in the companion dashboard.

Designed for ~150 participant learning reports of ~1000 words each.

Usage:
    python pdf_report_analyzer.py <pdf_directory> [--output analysis.json]
"""

import argparse
import json
import math
import os
import re
import string
import sys
from collections import Counter
from pathlib import Path

try:
    import PyPDF2
except ImportError:
    print("PyPDF2 not found. Install it: pip install PyPDF2")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(pdf_path):
    """Extract all text from a PDF file."""
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"  Warning: Could not read {pdf_path}: {e}")
    return text.strip()


def participant_name_from_filename(filename):
    """Derive a participant label from the PDF filename."""
    name = Path(filename).stem
    # Clean up common patterns
    name = re.sub(r"[-_]+", " ", name)
    return name.strip().title()


# ---------------------------------------------------------------------------
# Basic NLP utilities (no heavy dependencies required)
# ---------------------------------------------------------------------------

STOPWORDS = set("""
a about above after again against all am an and any are aren't as at be
because been before being below between both but by can't cannot could
couldn't did didn't do does doesn't doing don't down during each few for
from further get got had hadn't has hasn't have haven't having he he'd
he'll he's her here here's hers herself him himself his how how's i i'd
i'll i'm i've if in into is isn't it it's its itself just let's me more
most mustn't my myself no nor not of off on once only or other ought our
ours ourselves out over own same shan't she she'd she'll she's should
shouldn't so some such than that that's the their theirs them themselves
then there there's these they they'd they'll they're they've this those
through to too under until up upon us very was wasn't we we'd we'll we're
we've were weren't what what's when when's where where's which while who
who's whom why why's will with won't would wouldn't you you'd you'll
you're you've your yours yourself yourselves also really one two three
four five six seven eight nine ten many much using used use however still
within without across along although another since whether already even
also well back way like just know make go going made new said get take
think see come could well look find give first may way even people good
know right look think also work take well time very when come make like
over such year know back use find give most go say way some thing being
become began many well get take know going made first may day after before
how our been able will their would could should shall other
""".split())


def tokenize(text):
    """Lowercase, strip punctuation, split into tokens."""
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    tokens = text.split()
    return [t for t in tokens if len(t) > 2 and t not in STOPWORDS and not t.isdigit()]


def word_count(text):
    """Raw word count."""
    return len(text.split())


def sentence_count(text):
    """Approximate sentence count."""
    return max(1, len(re.split(r"[.!?]+", text)) - 1)


def avg_sentence_length(text):
    """Average words per sentence."""
    wc = word_count(text)
    sc = sentence_count(text)
    return round(wc / sc, 1) if sc else 0


def readability_score(text):
    """Simple Flesch-like readability approximation (0-100, higher = easier)."""
    wc = word_count(text)
    sc = sentence_count(text)
    if wc == 0 or sc == 0:
        return 0
    avg_wps = wc / sc
    # Approximate syllable count
    syllables = sum(max(1, len(re.findall(r"[aeiouy]+", w.lower()))) for w in text.split())
    avg_syl = syllables / wc
    score = 206.835 - 1.015 * avg_wps - 84.6 * avg_syl
    return round(max(0, min(100, score)), 1)


# ---------------------------------------------------------------------------
# TF-IDF (lightweight, no sklearn needed)
# ---------------------------------------------------------------------------

def compute_tfidf(documents_tokens):
    """
    Compute TF-IDF scores for a list of tokenized documents.
    Returns {doc_index: {term: tfidf_score}}.
    """
    n_docs = len(documents_tokens)
    # Document frequency
    df = Counter()
    for tokens in documents_tokens:
        unique = set(tokens)
        for t in unique:
            df[t] += 1

    tfidf = {}
    for idx, tokens in enumerate(documents_tokens):
        tf = Counter(tokens)
        total = len(tokens) if tokens else 1
        scores = {}
        for term, count in tf.items():
            tf_val = count / total
            idf_val = math.log((n_docs + 1) / (df[term] + 1)) + 1
            scores[term] = round(tf_val * idf_val, 6)
        tfidf[idx] = scores
    return tfidf


def extract_top_keywords(tfidf_scores, n=15):
    """Top-n keywords for a single document by TF-IDF."""
    sorted_terms = sorted(tfidf_scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_terms[:n]


# ---------------------------------------------------------------------------
# Theme / topic detection (simple clustering by keyword overlap)
# ---------------------------------------------------------------------------

def detect_themes(all_keywords, n_themes=10):
    """
    Group frequently co-occurring keywords into themes.
    Returns a list of theme dicts: {name, keywords, document_indices}.
    """
    # Global keyword frequency across documents
    global_freq = Counter()
    for doc_kw in all_keywords:
        for kw, _ in doc_kw:
            global_freq[kw] += 1

    # Pick top keywords that appear in multiple documents
    common = [kw for kw, cnt in global_freq.most_common(80) if cnt >= 2]

    # Simple co-occurrence matrix
    cooccur = Counter()
    for doc_kw in all_keywords:
        doc_terms = set(kw for kw, _ in doc_kw)
        present = [t for t in common if t in doc_terms]
        for i, a in enumerate(present):
            for b in present[i + 1:]:
                pair = tuple(sorted([a, b]))
                cooccur[pair] += 1

    # Greedy clustering
    used = set()
    themes = []
    for kw in common:
        if kw in used:
            continue
        cluster = [kw]
        used.add(kw)
        # Find co-occurring terms
        for pair, cnt in cooccur.most_common():
            if cnt < 2:
                break
            a, b = pair
            if a == kw and b not in used:
                cluster.append(b)
                used.add(b)
            elif b == kw and a not in used:
                cluster.append(a)
                used.add(a)
            if len(cluster) >= 6:
                break
        if len(cluster) >= 2:
            # Find which documents match this theme
            cluster_set = set(cluster)
            doc_indices = []
            for idx, doc_kw in enumerate(all_keywords):
                doc_terms = set(kw for kw, _ in doc_kw)
                if len(doc_terms & cluster_set) >= 2:
                    doc_indices.append(idx)
            themes.append({
                "name": cluster[0].title() + " & " + cluster[1].title(),
                "keywords": cluster,
                "document_count": len(doc_indices),
                "document_indices": doc_indices,
            })
        if len(themes) >= n_themes:
            break

    return themes


# ---------------------------------------------------------------------------
# Document similarity (cosine on TF-IDF vectors)
# ---------------------------------------------------------------------------

def cosine_similarity(vec_a, vec_b):
    """Cosine similarity between two sparse vectors (dicts)."""
    common_keys = set(vec_a.keys()) & set(vec_b.keys())
    if not common_keys:
        return 0.0
    dot = sum(vec_a[k] * vec_b[k] for k in common_keys)
    mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return round(dot / (mag_a * mag_b), 4)


def build_similarity_matrix(tfidf, max_docs=150):
    """Build a pairwise similarity matrix (list of lists)."""
    n = min(len(tfidf), max_docs)
    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append(1.0)
            elif j < i:
                row.append(matrix[j][i])  # symmetric
            else:
                row.append(cosine_similarity(tfidf[i], tfidf[j]))
        matrix.append(row)
    return matrix


# ---------------------------------------------------------------------------
# Simple 2D layout from similarity (MDS-like via spring embedding)
# ---------------------------------------------------------------------------

def compute_2d_layout(similarity_matrix, iterations=200):
    """
    Produce approximate 2D coordinates from a similarity matrix
    using a simple force-directed layout.
    """
    import random
    random.seed(42)
    n = len(similarity_matrix)
    if n == 0:
        return []

    # Initialise random positions
    pos = [(random.uniform(-1, 1), random.uniform(-1, 1)) for _ in range(n)]

    for iteration in range(iterations):
        lr = 0.1 * (1 - iteration / iterations)  # decaying learning rate
        forces = [(0.0, 0.0)] * n
        for i in range(n):
            fx, fy = 0.0, 0.0
            for j in range(n):
                if i == j:
                    continue
                dx = pos[j][0] - pos[i][0]
                dy = pos[j][1] - pos[i][1]
                dist = math.sqrt(dx * dx + dy * dy) + 1e-6
                # Attractive force proportional to similarity
                sim = similarity_matrix[i][j]
                # Repulsive force inversely proportional to distance
                attract = sim * dist * 0.5
                repulse = -0.01 / (dist * dist)
                force = attract + repulse
                fx += (dx / dist) * force
                fy += (dy / dist) * force
            forces[i] = (fx, fy)
        # Update positions
        new_pos = []
        for i in range(n):
            nx = pos[i][0] + lr * forces[i][0]
            ny = pos[i][1] + lr * forces[i][1]
            # Clamp
            nx = max(-10, min(10, nx))
            ny = max(-10, min(10, ny))
            new_pos.append((nx, ny))
        pos = new_pos

    # Normalise to 0-100 range
    if n == 1:
        return [(50, 50)]
    xs = [p[0] for p in pos]
    ys = [p[1] for p in pos]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    range_x = max_x - min_x if max_x != min_x else 1
    range_y = max_y - min_y if max_y != min_y else 1
    return [
        (round((p[0] - min_x) / range_x * 90 + 5, 2),
         round((p[1] - min_y) / range_y * 90 + 5, 2))
        for p in pos
    ]


# ---------------------------------------------------------------------------
# Sentiment (simple lexicon-based)
# ---------------------------------------------------------------------------

POSITIVE_WORDS = set("""
achieve achievement accomplished amazing appreciate appreciated
better breakthrough brilliant capable challenge challenges change
collaboration collaborative competent confident contribution
creative critical curious deeper develop developed development
discover discovered effective empowered engaged engagement
enhanced enjoy enjoyed enriching essential excellent exceptional
excited exciting experience experienced expertise explore
explored fascinating focus forward gain gained goal goals great
grew grow growing growth helpful idea ideas impact important
improve improved improvement incredible independence influence
innovative insightful inspiration inspired inspiring interest
interested interesting journey key knowledge lead leadership
learn learned learning leverage meaningful mentor motivated
motivation navigate new novel opportunity overcome passion
passionate perspective plan positive potential powerful practice
prepared productive professional proficiency progress purpose
realized recognize reflected resilience resilient resourceful
rewarding secure significant skill skilled skills solution
strategic strength strong succeed success successful support
talent team teamwork think thinking thrive transform understanding
unique valuable vision willing wisdom work worked
""".split())

NEGATIVE_WORDS = set("""
afraid anxious barrier barriers behind boring challenge
challenged challenging complex complicated concern concerned
confuse confused confusing critical criticism decline
deficiency deficit difficult difficulty disappoint disappointed
disappointing doubt doubted doubtful exhausted fail failed
failing failure fear feared fearful frustrate frustrated
frustrating gap gaps hard hesitant inadequate incomplete
ineffective insecure insufficient issue issues lack lacked
lacking limit limited limitation limitations lose lost miss
missed missing mistake mistakes misunderstand negative obstacle
obstacles overload overwhelmed overwhelming poor poorly problem
problems procrastinate reluctant risk scared setback setbacks
slow slowly stagnant stagnate stress stressed stressful struggle
struggled struggling stuck suffer suffered suffering tense
tension trouble troubled troublesome unable uncertain unclear
uncomfortable underperform unfamiliar unprepared unsure
vulnerable weak weakness weaknesses worry worried worrying worse
""".split())


def sentiment_score(tokens):
    """Return a sentiment score from -1 (negative) to +1 (positive)."""
    pos = sum(1 for t in tokens if t in POSITIVE_WORDS)
    neg = sum(1 for t in tokens if t in NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.0
    return round((pos - neg) / total, 3)


def sentiment_label(score):
    if score > 0.3:
        return "Positive"
    if score < -0.3:
        return "Negative"
    return "Mixed"


# ---------------------------------------------------------------------------
# Main analysis pipeline
# ---------------------------------------------------------------------------

def analyze_reports(pdf_directory, output_path="analysis.json"):
    """Run the full analysis pipeline."""
    pdf_dir = Path(pdf_directory)
    if not pdf_dir.is_dir():
        print(f"Error: '{pdf_directory}' is not a directory.")
        sys.exit(1)

    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"Error: No PDF files found in '{pdf_directory}'.")
        sys.exit(1)

    print(f"Found {len(pdf_files)} PDF files in '{pdf_directory}'.")
    print()

    # --- Extract text ---
    print("Step 1/6: Extracting text from PDFs...")
    documents = []
    for i, pdf_path in enumerate(pdf_files):
        text = extract_text_from_pdf(pdf_path)
        name = participant_name_from_filename(pdf_path.name)
        documents.append({
            "filename": pdf_path.name,
            "participant": name,
            "text": text,
        })
        if (i + 1) % 25 == 0 or i == len(pdf_files) - 1:
            print(f"  Extracted {i + 1}/{len(pdf_files)}")

    # --- Tokenize ---
    print("Step 2/6: Tokenizing and computing statistics...")
    all_tokens = []
    for doc in documents:
        tokens = tokenize(doc["text"])
        doc["word_count"] = word_count(doc["text"])
        doc["sentence_count"] = sentence_count(doc["text"])
        doc["avg_sentence_length"] = avg_sentence_length(doc["text"])
        doc["readability"] = readability_score(doc["text"])
        doc["unique_words"] = len(set(tokens))
        doc["tokens"] = tokens
        all_tokens.append(tokens)

    # --- TF-IDF ---
    print("Step 3/6: Computing TF-IDF keywords...")
    tfidf = compute_tfidf(all_tokens)
    all_keywords = []
    for idx, doc in enumerate(documents):
        kw = extract_top_keywords(tfidf[idx], n=15)
        doc["keywords"] = [{"word": w, "score": s} for w, s in kw]
        all_keywords.append(kw)

    # --- Themes ---
    print("Step 4/6: Detecting themes...")
    themes = detect_themes(all_keywords, n_themes=12)
    # Assign primary theme to each document
    for idx, doc in enumerate(documents):
        doc["themes"] = []
        for t_idx, theme in enumerate(themes):
            if idx in theme["document_indices"]:
                doc["themes"].append(theme["name"])
        if not doc["themes"]:
            doc["themes"] = ["Other"]

    # --- Sentiment ---
    print("Step 5/6: Analyzing sentiment...")
    for doc in documents:
        score = sentiment_score(doc["tokens"])
        doc["sentiment_score"] = score
        doc["sentiment_label"] = sentiment_label(score)

    # --- Similarity & layout ---
    print("Step 6/6: Computing similarity and layout...")
    sim_matrix = build_similarity_matrix(tfidf, max_docs=200)
    layout = compute_2d_layout(sim_matrix)

    for idx, doc in enumerate(documents):
        doc["x"] = layout[idx][0]
        doc["y"] = layout[idx][1]

    # --- Global stats ---
    global_word_freq = Counter()
    for tokens in all_tokens:
        global_word_freq.update(tokens)

    top_words_global = [
        {"word": w, "count": c}
        for w, c in global_word_freq.most_common(100)
    ]

    avg_word_count = round(sum(d["word_count"] for d in documents) / len(documents), 1)
    avg_readability = round(sum(d["readability"] for d in documents) / len(documents), 1)
    avg_sentiment = round(sum(d["sentiment_score"] for d in documents) / len(documents), 3)

    # --- Build output ---
    output_docs = []
    for doc in documents:
        output_docs.append({
            "filename": doc["filename"],
            "participant": doc["participant"],
            "word_count": doc["word_count"],
            "sentence_count": doc["sentence_count"],
            "avg_sentence_length": doc["avg_sentence_length"],
            "readability": doc["readability"],
            "unique_words": doc["unique_words"],
            "keywords": doc["keywords"],
            "themes": doc["themes"],
            "sentiment_score": doc["sentiment_score"],
            "sentiment_label": doc["sentiment_label"],
            "x": doc["x"],
            "y": doc["y"],
        })

    # Clean theme document_indices for JSON
    themes_output = []
    for t in themes:
        themes_output.append({
            "name": t["name"],
            "keywords": t["keywords"],
            "document_count": t["document_count"],
        })

    result = {
        "summary": {
            "total_reports": len(documents),
            "avg_word_count": avg_word_count,
            "avg_readability": avg_readability,
            "avg_sentiment": avg_sentiment,
            "theme_count": len(themes),
        },
        "themes": themes_output,
        "top_words": top_words_global,
        "documents": output_docs,
        "similarity_matrix": sim_matrix,
    }

    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print()
    print(f"Analysis complete. Results written to: {output_path}")
    print(f"  Reports analyzed:  {len(documents)}")
    print(f"  Themes detected:   {len(themes)}")
    print(f"  Avg word count:    {avg_word_count}")
    print(f"  Avg readability:   {avg_readability}")
    print(f"  Avg sentiment:     {avg_sentiment}")
    print()
    print(f"Open 'report_dashboard.html' in a browser and load '{output_path}' to explore.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Analyze a directory of PDF reports and produce a JSON data file for the dashboard."
    )
    parser.add_argument(
        "pdf_directory",
        help="Path to the directory containing PDF files",
    )
    parser.add_argument(
        "--output", "-o",
        default="analysis.json",
        help="Output JSON file path (default: analysis.json)",
    )
    args = parser.parse_args()
    analyze_reports(args.pdf_directory, args.output)


if __name__ == "__main__":
    main()
