"""
Optimized Voice Transcriber with Multiple API Providers
Supports: OpenAI Whisper, Groq, Azure, Local Whisper
Includes GPT-4 post-processing with optimal prompts
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import tempfile
import json
from datetime import datetime
import openai
from groq import Groq
import whisper

app = Flask(__name__)
CORS(app)

# Configuration
CONFIG_FILE = 'config/settings.json'

# Default configuration
DEFAULT_CONFIG = {
    'openai_api_key': '',
    'groq_api_key': '',
    'azure_api_key': '',
    'azure_endpoint': '',
    'default_provider': 'openai',
    'default_model': 'whisper-1',
    'enable_gpt4_processing': True,
    'gpt4_model': 'gpt-4-turbo-preview',
    'language': 'de',
    'temperature': 0.0
}

def load_config():
    """Load configuration from file"""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            # Merge with defaults for any missing keys
            return {**DEFAULT_CONFIG, **config}
    return DEFAULT_CONFIG.copy()

def save_config(config):
    """Save configuration to file"""
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

# Whisper model options
WHISPER_MODELS = {
    'openai': ['whisper-1'],
    'groq': ['whisper-large-v3', 'whisper-large-v3-turbo'],
    'local': ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'],
    'azure': ['whisper-1']
}

# GPT-4 Optimization Prompts
GPT4_PROMPTS = {
    'correct_grammar': """Korrigiere den folgenden transkribierten Text. Verbessere Grammatik, Rechtschreibung und Zeichensetzung, aber ändere nicht den Inhalt oder die Bedeutung. Gib nur den korrigierten Text zurück, ohne zusätzliche Kommentare.

Text: {text}

Korrigierter Text:""",

    'add_punctuation': """Füge dem folgenden transkribierten Text korrekte Satzzeichen und Absätze hinzu. Strukturiere den Text logisch, aber ändere nicht den Wortlaut. Gib nur den formatierten Text zurück.

Text: {text}

Formatierter Text:""",

    'summarize': """Erstelle eine präzise Zusammenfassung des folgenden transkribierten Texts. Erfasse die Hauptpunkte und wichtigsten Informationen.

Text: {text}

Zusammenfassung:""",

    'professional': """Formuliere den folgenden transkribierten Text professioneller und formeller, während du den ursprünglichen Inhalt beibehältst.

Text: {text}

Professionelle Version:""",

    'bullet_points': """Extrahiere die wichtigsten Punkte aus dem folgenden transkribierten Text und präsentiere sie als strukturierte Aufzählungsliste.

Text: {text}

Hauptpunkte:"""
}

def transcribe_openai(audio_file, model='whisper-1', language='de', config=None):
    """Transcribe audio using OpenAI Whisper API"""
    if not config or not config.get('openai_api_key'):
        raise ValueError("OpenAI API Key nicht konfiguriert")

    openai.api_key = config['openai_api_key']

    with open(audio_file, 'rb') as f:
        transcript = openai.audio.transcriptions.create(
            model=model,
            file=f,
            language=language,
            response_format="verbose_json"
        )

    return {
        'text': transcript.text,
        'language': getattr(transcript, 'language', language),
        'duration': getattr(transcript, 'duration', None)
    }

def transcribe_groq(audio_file, model='whisper-large-v3', language='de', config=None):
    """Transcribe audio using Groq Whisper API"""
    if not config or not config.get('groq_api_key'):
        raise ValueError("Groq API Key nicht konfiguriert")

    client = Groq(api_key=config['groq_api_key'])

    with open(audio_file, 'rb') as f:
        transcript = client.audio.transcriptions.create(
            model=model,
            file=f,
            language=language,
            response_format="verbose_json"
        )

    return {
        'text': transcript.text,
        'language': getattr(transcript, 'language', language),
        'duration': getattr(transcript, 'duration', None)
    }

def transcribe_local(audio_file, model='base', language='de', config=None):
    """Transcribe audio using local Whisper model"""
    model_instance = whisper.load_model(model)
    result = model_instance.transcribe(audio_file, language=language)

    return {
        'text': result['text'],
        'language': result.get('language', language),
        'duration': None
    }

def process_with_gpt4(text, prompt_type='correct_grammar', config=None):
    """Process transcribed text with GPT-4"""
    if not config or not config.get('openai_api_key'):
        raise ValueError("OpenAI API Key für GPT-4 nicht konfiguriert")

    if prompt_type not in GPT4_PROMPTS:
        prompt_type = 'correct_grammar'

    openai.api_key = config['openai_api_key']

    prompt = GPT4_PROMPTS[prompt_type].format(text=text)

    response = openai.chat.completions.create(
        model=config.get('gpt4_model', 'gpt-4-turbo-preview'),
        messages=[
            {"role": "system", "content": "Du bist ein hilfreicher Assistent, der Text präzise bearbeitet und verbessert."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=4000
    )

    return response.choices[0].message.content.strip()

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get current configuration (without sensitive data)"""
    config = load_config()
    safe_config = config.copy()
    # Hide API keys
    if safe_config.get('openai_api_key'):
        safe_config['openai_api_key'] = '***' if safe_config['openai_api_key'] else ''
    if safe_config.get('groq_api_key'):
        safe_config['groq_api_key'] = '***' if safe_config['groq_api_key'] else ''
    if safe_config.get('azure_api_key'):
        safe_config['azure_api_key'] = '***' if safe_config['azure_api_key'] else ''

    return jsonify({
        'success': True,
        'config': safe_config,
        'models': WHISPER_MODELS
    })

@app.route('/api/config', methods=['POST'])
def update_config():
    """Update configuration"""
    try:
        new_config = request.json
        current_config = load_config()

        # Update only provided fields
        for key, value in new_config.items():
            if key in DEFAULT_CONFIG:
                # Don't overwrite with placeholder
                if value != '***':
                    current_config[key] = value

        save_config(current_config)

        return jsonify({
            'success': True,
            'message': 'Konfiguration erfolgreich gespeichert'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """Transcribe audio file"""
    try:
        if 'audio' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Keine Audio-Datei hochgeladen'
            }), 400

        audio_file = request.files['audio']
        provider = request.form.get('provider', 'openai')
        model = request.form.get('model', 'whisper-1')
        language = request.form.get('language', 'de')
        gpt4_processing = request.form.get('gpt4_processing', 'false') == 'true'
        gpt4_prompt_type = request.form.get('gpt4_prompt_type', 'correct_grammar')

        config = load_config()

        # Save audio file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as temp_file:
            audio_file.save(temp_file.name)
            temp_path = temp_file.name

        try:
            # Transcribe based on provider
            if provider == 'openai':
                result = transcribe_openai(temp_path, model, language, config)
            elif provider == 'groq':
                result = transcribe_groq(temp_path, model, language, config)
            elif provider == 'local':
                result = transcribe_local(temp_path, model, language, config)
            else:
                raise ValueError(f"Unbekannter Provider: {provider}")

            transcribed_text = result['text']
            processed_text = None

            # Apply GPT-4 processing if enabled
            if gpt4_processing and transcribed_text:
                try:
                    processed_text = process_with_gpt4(transcribed_text, gpt4_prompt_type, config)
                except Exception as e:
                    # Continue even if GPT-4 processing fails
                    print(f"GPT-4 processing error: {e}")

            return jsonify({
                'success': True,
                'transcription': transcribed_text,
                'processed': processed_text,
                'language': result.get('language'),
                'duration': result.get('duration'),
                'provider': provider,
                'model': model,
                'timestamp': datetime.now().isoformat()
            })

        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpt4-process', methods=['POST'])
def gpt4_process():
    """Process text with GPT-4"""
    try:
        data = request.json
        text = data.get('text', '')
        prompt_type = data.get('prompt_type', 'correct_grammar')

        if not text:
            return jsonify({
                'success': False,
                'error': 'Kein Text angegeben'
            }), 400

        config = load_config()
        processed_text = process_with_gpt4(text, prompt_type, config)

        return jsonify({
            'success': True,
            'processed': processed_text,
            'prompt_type': prompt_type
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/manifest.json')
def manifest():
    """Serve PWA manifest"""
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def service_worker():
    """Serve service worker"""
    return send_from_directory('static/js', 'sw.js')

if __name__ == '__main__':
    # Ensure config directory exists
    os.makedirs('config', exist_ok=True)

    # Initialize config if not exists
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)

    print("=" * 60)
    print("🎤 Optimized Voice Transcriber gestartet!")
    print("=" * 60)
    print("📱 Öffnen Sie http://localhost:5000 im Browser")
    print("📱 Für Samsung Tablet: http://[IHRE-IP]:5000")
    print("=" * 60)

    app.run(host='0.0.0.0', port=5000, debug=True)
