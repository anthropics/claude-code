# 🔥 GUIDE D'INSTALLATION NEMESIS MCP OMEGA

## 📋 À PROPOS

Ce script **PowerShell monolithique** résout définitivement les problèmes de serveurs MCP dans Claude Desktop :

- ❌ **Docling MCP** : Could not attach
- ❌ **aws-apl-mcp-server** : Could not attach
- ❌ **Kapture Browser** : Server disconnected

## ✨ CARACTÉRISTIQUES

- ✅ **Installation 100% automatique** - Aucune intervention manuelle
- ✅ **Fenêtre JAMAIS fermée** - Monitoring continu
- ✅ **Auto-réparation** - Détecte et corrige les problèmes
- ✅ **Installation complète** - Chocolatey, Node, Python, Docker, Claude Desktop
- ✅ **10+ serveurs MCP** - Filesystem, Memory, GitHub, Slack, etc.
- ✅ **Validation automatique** - Tests après installation
- ✅ **Logs détaillés** - Traçabilité complète

## 🚀 INSTALLATION EN 3 ÉTAPES

### Étape 1 : Ouvrir PowerShell en Administrateur

1. Appuyez sur `Windows + X`
2. Cliquez sur **"Windows PowerShell (Administrateur)"** ou **"Terminal (Admin)"**
3. Si une fenêtre UAC apparaît, cliquez **"Oui"**

### Étape 2 : Autoriser l'exécution de scripts

Copiez-collez cette commande dans PowerShell :

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
```

### Étape 3 : Exécuter le script

**Option A : Copier-coller direct (recommandé)**

1. Ouvrez le fichier `NEMESIS-MCP-ULTIMATE.ps1`
2. Sélectionnez TOUT le contenu (Ctrl+A)
3. Copiez (Ctrl+C)
4. Collez dans PowerShell (Clic droit)
5. Appuyez sur Entrée

**Option B : Exécution depuis le fichier**

```powershell
cd "C:\chemin\vers\le\dossier"
.\NEMESIS-MCP-ULTIMATE.ps1
```

## ⏱️ DURÉE D'INSTALLATION

| Composant | Temps estimé |
|-----------|--------------|
| Chocolatey | 30 secondes |
| NodeJS/Python | 2 minutes |
| Serveurs MCP | 3 minutes |
| Claude Desktop | 2 minutes |
| **TOTAL** | **~8 minutes** |

## 📊 CE QUE LE SCRIPT INSTALLE

### Outils de base
- ✅ Chocolatey (gestionnaire de paquets)
- ✅ Git
- ✅ NodeJS v25+ et NPM
- ✅ Python 3.13+
- ✅ JQ (outil JSON)

### Serveurs MCP
1. **@modelcontextprotocol/server-filesystem** - Accès fichiers
2. **@modelcontextprotocol/server-memory** - Mémoire conversationnelle
3. **@modelcontextprotocol/server-fetch** - Requêtes HTTP
4. **@modelcontextprotocol/server-github** - Intégration GitHub
5. **@modelcontextprotocol/server-gitlab** - Intégration GitLab
6. **@modelcontextprotocol/server-slack** - Intégration Slack
7. **@modelcontextprotocol/server-postgres** - Base de données PostgreSQL
8. **@modelcontextprotocol/server-sqlite** - Base de données SQLite
9. **@modelcontextprotocol/server-brave-search** - Recherche Brave
10. **@modelcontextprotocol/server-google-drive** - Google Drive

### Applications
- ✅ **Claude Desktop** (installation automatique si absent)
- ⏳ **Docker Desktop** (installation en arrière-plan)

## 🔍 VÉRIFICATION POST-INSTALLATION

Après l'exécution du script :

### 1. Ouvrir Claude Desktop

- Le script lance automatiquement Claude Desktop
- Si ce n'est pas le cas, lancez-le manuellement

### 2. Accéder aux paramètres MCP

1. Cliquez sur l'icône **⚙️ Paramètres** (en bas à gauche)
2. Sélectionnez **"Développeur"** ou **"Developer"**
3. Section **"MCP Servers"**

### 3. Vérifier les serveurs actifs

Vous devriez voir :

```
✅ filesystem
✅ memory
✅ fetch
⚠️ github (token requis)
⚠️ brave-search (clé API requise)
✅ postgres
✅ sqlite
```

## 🔐 CONFIGURATION DES TOKENS (OPTIONNEL)

Pour activer les serveurs avec authentification :

### GitHub

1. Allez sur https://github.com/settings/tokens
2. Cliquez **"Generate new token (classic)"**
3. Sélectionnez les permissions : `repo`, `read:user`
4. Copiez le token généré
5. Éditez `%APPDATA%\Claude\claude_desktop_config.json`
6. Remplacez `""` par votre token dans `GITHUB_PERSONAL_ACCESS_TOKEN`

### Brave Search

1. Allez sur https://brave.com/search/api/
2. Créez un compte et obtenez une clé API
3. Éditez `%APPDATA%\Claude\claude_desktop_config.json`
4. Remplacez `""` par votre clé dans `BRAVE_API_KEY`

### Google Drive

1. Suivez https://developers.google.com/drive/api/quickstart/python
2. Configurez les clés OAuth2
3. Ajoutez dans le fichier de configuration

## 🐛 RÉSOLUTION DE PROBLÈMES

### Problème : "Impossible d'exécuter des scripts PowerShell"

**Solution :**
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
```

### Problème : "Claude Desktop ne se lance pas"

**Solution :**
1. Vérifiez si installé : `C:\Users\VOTRE_NOM\AppData\Local\Programs\claude-desktop\Claude.exe`
2. Si absent, téléchargez manuellement : https://claude.ai/download
3. Relancez le script après installation

### Problème : "Les serveurs MCP n'apparaissent pas"

**Solution :**
1. Fermez **complètement** Claude Desktop (clic droit icône > Quitter)
2. Relancez Claude Desktop
3. Allez dans Paramètres > Développeur
4. Les serveurs devraient apparaître

### Problème : "Docker n'est pas installé"

**Note :** Docker est optionnel pour les serveurs MCP de base.

**Si besoin :**
```powershell
winget install Docker.DockerDesktop
```

## 📁 FICHIERS IMPORTANTS

| Fichier | Emplacement | Description |
|---------|-------------|-------------|
| **Configuration MCP** | `%APPDATA%\Claude\claude_desktop_config.json` | Config des serveurs |
| **Logs d'installation** | `%USERPROFILE%\.nemesis-omega\logs\` | Logs détaillés |
| **Dossier NEMESIS** | `%USERPROFILE%\.nemesis-omega\` | Données du script |

## 🔄 RÉINSTALLATION / MISE À JOUR

Pour réinstaller ou mettre à jour :

1. Supprimez le fichier de configuration :
   ```powershell
   Remove-Item "$env:APPDATA\Claude\claude_desktop_config.json"
   ```

2. Relancez le script complet

## 📞 SUPPORT

En cas de problème :

1. Vérifiez les logs dans `%USERPROFILE%\.nemesis-omega\logs\`
2. Consultez la section "Résolution de problèmes" ci-dessus
3. Relancez le script (il est idempotent - peut être exécuté plusieurs fois)

## 🎯 RÉSULTATS ATTENDUS

Après installation réussie :

- ✅ Claude Desktop opérationnel
- ✅ 7+ serveurs MCP actifs
- ✅ Accès filesystem, mémoire, fetch fonctionnels
- ✅ Console de monitoring active
- ✅ Configuration sauvegardée

## 🚨 IMPORTANT

- **Ne fermez PAS** la console PowerShell pendant l'installation
- Le script maintient la console ouverte pour monitoring
- Pour fermer : `Ctrl+C` dans la console

---

**Version :** 11.0
**Auteur :** NEMESIS OMEGA
**Pour :** Pierre Tagnard - CGP IAE Grenoble
**Date :** Janvier 2025
