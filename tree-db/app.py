from flask import Flask, render_template, request, redirect, url_for, jsonify
import sqlite3
import os
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

DB_PATH = 'trees.db'


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS trees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            species TEXT,
            location TEXT,
            condition TEXT,
            note TEXT,
            photo TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    keyword = request.args.get('q', '')
    species = request.args.get('species', '')
    condition = request.args.get('condition', '')

    conn = get_db()
    query = 'SELECT * FROM trees WHERE 1=1'
    params = []

    if keyword:
        query += ' AND (name LIKE ? OR location LIKE ? OR note LIKE ?)'
        params += [f'%{keyword}%', f'%{keyword}%', f'%{keyword}%']
    if species:
        query += ' AND species = ?'
        params.append(species)
    if condition:
        query += ' AND condition = ?'
        params.append(condition)

    query += ' ORDER BY created_at DESC'
    trees = conn.execute(query, params).fetchall()

    species_list = conn.execute('SELECT DISTINCT species FROM trees WHERE species IS NOT NULL ORDER BY species').fetchall()
    conn.close()

    return render_template('index.html', trees=trees, species_list=species_list,
                           keyword=keyword, selected_species=species, selected_condition=condition)


@app.route('/add', methods=['GET', 'POST'])
def add():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        species = request.form.get('species', '').strip()
        location = request.form.get('location', '').strip()
        condition = request.form.get('condition', '')
        note = request.form.get('note', '').strip()

        photo_filename = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file and file.filename and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                photo_filename = f"{uuid.uuid4().hex}.{ext}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], photo_filename))

        conn = get_db()
        conn.execute(
            'INSERT INTO trees (name, species, location, condition, note, photo) VALUES (?, ?, ?, ?, ?, ?)',
            (name, species, location, condition, note, photo_filename)
        )
        conn.commit()
        conn.close()
        return redirect(url_for('index'))

    return render_template('add.html')


@app.route('/tree/<int:tree_id>')
def detail(tree_id):
    conn = get_db()
    tree = conn.execute('SELECT * FROM trees WHERE id = ?', (tree_id,)).fetchone()
    conn.close()
    if not tree:
        return redirect(url_for('index'))
    return render_template('detail.html', tree=tree)


@app.route('/tree/<int:tree_id>/delete', methods=['POST'])
def delete(tree_id):
    conn = get_db()
    tree = conn.execute('SELECT photo FROM trees WHERE id = ?', (tree_id,)).fetchone()
    if tree and tree['photo']:
        path = os.path.join(app.config['UPLOAD_FOLDER'], tree['photo'])
        if os.path.exists(path):
            os.remove(path)
    conn.execute('DELETE FROM trees WHERE id = ?', (tree_id,))
    conn.commit()
    conn.close()
    return redirect(url_for('index'))


@app.route('/api/stats')
def stats():
    conn = get_db()
    total = conn.execute('SELECT COUNT(*) as c FROM trees').fetchone()['c']
    by_condition = conn.execute('SELECT condition, COUNT(*) as c FROM trees GROUP BY condition').fetchall()
    conn.close()
    return jsonify({
        'total': total,
        'by_condition': {row['condition']: row['c'] for row in by_condition}
    })


if __name__ == '__main__':
    init_db()
    app.run(debug=True)
