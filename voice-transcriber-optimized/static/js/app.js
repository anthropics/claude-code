// Voice Transcriber Pro - Main Application Script

class VoiceTranscriberApp {
    constructor() {
        this.config = null;
        this.currentFile = null;
        this.models = null;

        this.init();
    }

    async init() {
        this.setupElements();
        this.setupEventListeners();
        await this.loadConfig();
        this.setupDragAndDrop();
    }

    setupElements() {
        // Upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.audioInput = document.getElementById('audioInput');
        this.selectFileBtn = document.getElementById('selectFileBtn');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.removeFileBtn = document.getElementById('removeFileBtn');

        // Option elements
        this.providerSelect = document.getElementById('providerSelect');
        this.modelSelect = document.getElementById('modelSelect');
        this.languageSelect = document.getElementById('languageSelect');

        // GPT-4 elements
        this.enableGpt4 = document.getElementById('enableGpt4');
        this.gpt4Options = document.getElementById('gpt4Options');
        this.gpt4PromptType = document.getElementById('gpt4PromptType');

        // Transcribe elements
        this.transcribeBtn = document.getElementById('transcribeBtn');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');

        // Results elements
        this.resultsSection = document.getElementById('resultsSection');
        this.originalText = document.getElementById('originalText');
        this.processedCard = document.getElementById('processedCard');
        this.processedText = document.getElementById('processedText');
        this.resultMeta = document.getElementById('resultMeta');
        this.processedMeta = document.getElementById('processedMeta');
        this.copyBtn = document.getElementById('copyBtn');
        this.downloadBtn = document.getElementById('downloadBtn');

        // Settings elements
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');

        this.openaiApiKey = document.getElementById('openaiApiKey');
        this.groqApiKey = document.getElementById('groqApiKey');
        this.gpt4Model = document.getElementById('gpt4Model');
        this.enableGpt4Default = document.getElementById('enableGpt4Default');
        this.defaultProvider = document.getElementById('defaultProvider');
        this.defaultLanguage = document.getElementById('defaultLanguage');
    }

    setupEventListeners() {
        // File selection
        this.selectFileBtn.addEventListener('click', () => this.audioInput.click());
        this.uploadArea.addEventListener('click', () => this.audioInput.click());
        this.audioInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.removeFileBtn.addEventListener('click', () => this.removeFile());

        // Provider change
        this.providerSelect.addEventListener('change', () => this.updateModelOptions());

        // GPT-4 toggle
        this.enableGpt4.addEventListener('change', (e) => {
            this.gpt4Options.style.display = e.target.checked ? 'block' : 'none';
        });

        // Transcribe
        this.transcribeBtn.addEventListener('click', () => this.transcribe());

        // Results
        this.copyBtn.addEventListener('click', () => this.copyResult());
        this.downloadBtn.addEventListener('click', () => this.downloadResult());

        // Settings
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.cancelSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // Close modal on outside click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettings();
            }
        });
    }

    setupDragAndDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => {
                this.uploadArea.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => {
                this.uploadArea.classList.remove('drag-over');
            });
        });

        this.uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm'];
        const isValidType = validTypes.some(type => file.type.includes(type.split('/')[1]));

        if (!isValidType && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
            this.showToast('error', 'Ungültiges Format', 'Bitte wählen Sie eine Audio-Datei (MP3, WAV, M4A, OGG, WebM)');
            return;
        }

        // Validate file size (max 25MB for OpenAI, 100MB for others)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (file.size > maxSize) {
            this.showToast('warning', 'Große Datei', 'Datei ist größer als 25MB. Manche Provider könnten dies ablehnen.');
        }

        this.currentFile = file;
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);

        this.uploadArea.style.display = 'none';
        this.fileInfo.style.display = 'flex';
        this.transcribeBtn.disabled = false;
    }

    removeFile() {
        this.currentFile = null;
        this.audioInput.value = '';
        this.uploadArea.style.display = 'block';
        this.fileInfo.style.display = 'none';
        this.transcribeBtn.disabled = true;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();

            if (data.success) {
                this.config = data.config;
                this.models = data.models;

                // Update UI with config
                this.providerSelect.value = this.config.default_provider;
                this.languageSelect.value = this.config.language;
                this.enableGpt4.checked = this.config.enable_gpt4_processing;
                this.gpt4Options.style.display = this.config.enable_gpt4_processing ? 'block' : 'none';

                this.updateModelOptions();
            }
        } catch (error) {
            console.error('Config load error:', error);
            this.showToast('error', 'Fehler', 'Konfiguration konnte nicht geladen werden');
        }
    }

    updateModelOptions() {
        const provider = this.providerSelect.value;
        const models = this.models[provider] || [];

        this.modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            this.modelSelect.appendChild(option);
        });
    }

    async transcribe() {
        if (!this.currentFile) {
            this.showToast('error', 'Keine Datei', 'Bitte wählen Sie eine Audio-Datei aus');
            return;
        }

        const formData = new FormData();
        formData.append('audio', this.currentFile);
        formData.append('provider', this.providerSelect.value);
        formData.append('model', this.modelSelect.value);
        formData.append('language', this.languageSelect.value);
        formData.append('gpt4_processing', this.enableGpt4.checked);
        formData.append('gpt4_prompt_type', this.gpt4PromptType.value);

        // Show progress
        this.transcribeBtn.disabled = true;
        this.progressContainer.style.display = 'block';
        this.progressFill.style.width = '0%';
        this.progressText.textContent = 'Wird hochgeladen...';
        this.resultsSection.style.display = 'none';

        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress > 90) progress = 90;
            this.progressFill.style.width = progress + '%';
        }, 300);

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            clearInterval(progressInterval);
            this.progressFill.style.width = '100%';

            if (data.success) {
                this.progressText.textContent = 'Fertig!';

                setTimeout(() => {
                    this.displayResults(data);
                    this.progressContainer.style.display = 'none';
                    this.transcribeBtn.disabled = false;
                }, 500);

                this.showToast('success', 'Erfolgreich', 'Transkription abgeschlossen');
            } else {
                throw new Error(data.error || 'Transkription fehlgeschlagen');
            }
        } catch (error) {
            clearInterval(progressInterval);
            this.progressContainer.style.display = 'none';
            this.transcribeBtn.disabled = false;

            console.error('Transcription error:', error);
            this.showToast('error', 'Fehler', error.message || 'Transkription fehlgeschlagen');
        }
    }

    displayResults(data) {
        // Original transcription
        this.originalText.textContent = data.transcription;
        this.resultMeta.textContent = `${data.provider} · ${data.model}${data.language ? ' · ' + data.language.toUpperCase() : ''}`;

        // Processed text
        if (data.processed) {
            this.processedText.textContent = data.processed;
            this.processedMeta.textContent = 'GPT-4 Post-Processing';
            this.processedCard.style.display = 'block';
        } else {
            this.processedCard.style.display = 'none';
        }

        this.resultsSection.style.display = 'block';

        // Scroll to results
        setTimeout(() => {
            this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    copyResult() {
        const textToCopy = this.processedText.textContent || this.originalText.textContent;

        navigator.clipboard.writeText(textToCopy).then(() => {
            this.showToast('success', 'Kopiert', 'Text in die Zwischenablage kopiert');
        }).catch(err => {
            console.error('Copy error:', err);
            this.showToast('error', 'Fehler', 'Kopieren fehlgeschlagen');
        });
    }

    downloadResult() {
        const textToDownload = this.processedText.textContent || this.originalText.textContent;
        const blob = new Blob([textToDownload], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `transkription_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('success', 'Download', 'Datei wurde heruntergeladen');
    }

    openSettings() {
        // Load current config into form
        if (this.config) {
            this.openaiApiKey.value = this.config.openai_api_key === '***' ? '' : this.config.openai_api_key;
            this.groqApiKey.value = this.config.groq_api_key === '***' ? '' : this.config.groq_api_key;
            this.gpt4Model.value = this.config.gpt4_model;
            this.enableGpt4Default.checked = this.config.enable_gpt4_processing;
            this.defaultProvider.value = this.config.default_provider;
            this.defaultLanguage.value = this.config.language;
        }

        this.settingsModal.classList.add('active');
    }

    closeSettings() {
        this.settingsModal.classList.remove('active');
    }

    async saveSettings() {
        const newConfig = {
            openai_api_key: this.openaiApiKey.value || this.config.openai_api_key,
            groq_api_key: this.groqApiKey.value || this.config.groq_api_key,
            gpt4_model: this.gpt4Model.value,
            enable_gpt4_processing: this.enableGpt4Default.checked,
            default_provider: this.defaultProvider.value,
            language: this.defaultLanguage.value
        };

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newConfig)
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('success', 'Gespeichert', 'Einstellungen wurden gespeichert');
                this.closeSettings();
                await this.loadConfig();
            } else {
                throw new Error(data.error || 'Speichern fehlgeschlagen');
            }
        } catch (error) {
            console.error('Save settings error:', error);
            this.showToast('error', 'Fehler', error.message || 'Einstellungen konnten nicht gespeichert werden');
        }
    }

    showToast(type, title, message) {
        const toastContainer = document.getElementById('toastContainer');

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconMap = {
            success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };

        toast.innerHTML = `
            ${iconMap[type] || iconMap.info}
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 300);
        }, 4000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new VoiceTranscriberApp();
});
