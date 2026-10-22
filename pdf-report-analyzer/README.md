# PDF Report Analyzer

Analyzes a collection of PDF reports and produces an interactive visualization dashboard. Designed for ~150 participant learning reports of ~1000 words each.

## What It Does

**Python analyzer** (`pdf_report_analyzer.py`) extracts text from your PDFs and runs:

- **Keyword extraction** — TF-IDF identifies the most distinctive terms per report and across the whole corpus
- **Theme detection** — Groups co-occurring keywords into themes and assigns each report to one or more themes
- **Sentiment analysis** — Lexicon-based scoring from -1 (negative) to +1 (positive), tuned for learning/reflection language
- **Readability scoring** — Flesch-scale approximation (0-100, higher = easier to read)
- **Similarity mapping** — Cosine similarity on TF-IDF vectors, with a 2D force-directed layout so you can see which reports are most alike
- **Statistics** — Word counts, sentence counts, unique vocabulary per report

**HTML dashboard** (`report_dashboard.html`) visualizes the results with:

- Summary cards (totals, averages)
- Word count, sentiment, and readability distribution charts
- Theme frequency chart and theme detail cards
- Interactive similarity map (hover to see report details)
- Word cloud of the top 80 terms
- Sortable, searchable table of all reports

## Quick Start

```bash
# 1. Install the single dependency
pip install -r requirements.txt

# 2. Run the analyzer on your PDF folder
python pdf_report_analyzer.py /path/to/your/pdfs --output analysis.json

# 3. Open the dashboard in a browser
open report_dashboard.html   # macOS
xdg-open report_dashboard.html  # Linux
# or just double-click the file
```

Then click **"Choose analysis.json"** in the dashboard to load your data. You can also click **"Load Demo Data"** to see the dashboard with synthetic data.

## Usage

```
python pdf_report_analyzer.py <pdf_directory> [--output analysis.json]
```

| Argument | Description |
|---|---|
| `pdf_directory` | Path to the folder containing your PDF files |
| `--output`, `-o` | Output JSON path (default: `analysis.json`) |

## How It Works

1. Text is extracted from each PDF using PyPDF2
2. Participant names are derived from filenames (e.g. `jane_smith_report.pdf` → "Jane Smith Report")
3. Text is tokenized, stopwords removed, and TF-IDF scores computed across the full corpus
4. Themes are detected by finding groups of keywords that frequently co-occur across multiple reports
5. Sentiment is scored using curated positive/negative word lists relevant to learning and professional development
6. Pairwise cosine similarity is computed, and a force-directed layout produces 2D coordinates for the similarity map
7. Everything is written to a single JSON file that the dashboard reads client-side

## Dependencies

- **Python 3.7+**
- **PyPDF2** — PDF text extraction (the only pip dependency)
- A modern browser for the dashboard (no server required, it's a static HTML file)

No heavy NLP libraries (spaCy, NLTK, sklearn) are required. All analysis is implemented from scratch to keep the tool lightweight and easy to install.

## Output Format

The JSON output contains:

```json
{
  "summary": { "total_reports": 150, "avg_word_count": 980, ... },
  "themes": [{ "name": "Leadership & Growth", "keywords": [...], "document_count": 42 }, ...],
  "top_words": [{ "word": "learning", "count": 312 }, ...],
  "documents": [{ "participant": "Jane Smith", "word_count": 1023, "keywords": [...], ... }],
  "similarity_matrix": [[1.0, 0.23, ...], ...]
}
```
