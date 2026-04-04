from flask import Flask, render_template, request, redirect, url_for, flash
from pathlib import Path
import subprocess, sys, os

app = Flask(__name__)
app.secret_key = 'omer-secret'

WORKDIR = Path(__file__).resolve().parent

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    text = request.form.get('text', '').strip()
    if not text:
        flash('Lütfen analiz için metin girin.', 'error')
        return redirect(url_for('index'))

    temp_file = WORKDIR / 'tmp_text.txt'
    temp_file.write_text(text, encoding='utf-8')

    cmd = [sys.executable, str(WORKDIR / 'analyze.py'), str(temp_file)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stdout if result.returncode == 0 else result.stderr

    return render_template('analysis.html', output=output)

@app.route('/finance', methods=['POST'])
def finance():
    csv_text = request.form.get('csv', '').strip()
    if not csv_text:
        flash('Lütfen CSV formatında finans verisi girin.', 'error')
        return redirect(url_for('index'))

    csv_file = WORKDIR / 'tmp_finance.csv'
    csv_file.write_text(csv_text, encoding='utf-8')

    cmd = [sys.executable, str(WORKDIR / 'finance_analysis.py'), str(csv_file), '--top-category', '5', '--dashboard']
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stdout if result.returncode == 0 else result.stderr

    return render_template('analysis.html', output=output)

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
