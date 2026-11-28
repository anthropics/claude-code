# 🚀 GUIDE ULTRA-RAPIDE - NEMESIS MCP AUTO-INSTALLER

## ⚡ Installation en 2 CLICS (Littéralement !)

### Méthode 1 : La plus simple (RECOMMANDÉE)

1. **Téléchargez** le fichier `NEMESIS-AUTO-INSTALL.ps1`
2. **Clic droit** sur le fichier > **"Exécuter avec PowerShell"**

**C'EST TOUT !** 🎉

Le script fait **TOUT automatiquement** :
- ✅ S'élève en administrateur tout seul
- ✅ Installe tous les outils nécessaires
- ✅ Installe 10 serveurs MCP
- ✅ Configure Claude Desktop
- ✅ Lance Claude Desktop
- ✅ Affiche un rapport complet

---

### Méthode 2 : Depuis PowerShell

1. **Ouvrez PowerShell** (pas besoin d'admin, le script le fait tout seul)
2. **Copiez-collez** cette commande :

```powershell
cd "C:\chemin\vers\le\dossier"
.\NEMESIS-AUTO-INSTALL.ps1
```

**C'EST TOUT !** 🎉

---

## ⏱️ Durée totale

**Environ 5-8 minutes** selon votre connexion internet

Le script affiche une progression en temps réel avec pourcentage.

---

## 📊 Ce qui est installé automatiquement

### Outils de base
- ✅ Chocolatey (gestionnaire de paquets Windows)
- ✅ Git
- ✅ NodeJS + NPM
- ✅ Python
- ✅ JQ (outil JSON)

### Serveurs MCP (10 au total)
1. **filesystem** - Accès aux fichiers locaux
2. **memory** - Mémoire conversationnelle
3. **fetch** - Requêtes HTTP
4. **github** - Intégration GitHub
5. **gitlab** - Intégration GitLab
6. **slack** - Intégration Slack
7. **postgres** - Base de données PostgreSQL
8. **sqlite** - Base de données SQLite
9. **brave-search** - Recherche web Brave
10. **google-drive** - Google Drive

### Application
- ✅ **Claude Desktop** (détecté ou installé automatiquement)

---

## ✅ Vérification après installation

Le script affiche automatiquement un rapport complet.

### Dans Claude Desktop

1. Ouvrez Claude Desktop (lancé automatiquement)
2. Cliquez sur **⚙️ Paramètres** (en bas à gauche)
3. Allez dans **"Développeur"** ou **"Developer"**
4. Section **"MCP Servers"**

Vous devriez voir :

```
✅ filesystem       - Prêt à l'emploi
✅ memory          - Prêt à l'emploi
✅ fetch           - Prêt à l'emploi
✅ postgres        - Prêt à l'emploi
✅ sqlite          - Prêt à l'emploi
⚠️ github          - Token requis
⚠️ gitlab          - Token requis
⚠️ slack           - Token requis
⚠️ brave-search    - API key requise
⚠️ google-drive    - OAuth requis
```

---

## 🔐 Configuration des tokens (OPTIONNEL)

Les 5 premiers serveurs fonctionnent **immédiatement sans configuration**.

Pour activer les autres :

### GitHub
1. Allez sur https://github.com/settings/tokens
2. **Generate new token (classic)**
3. Sélectionnez : `repo`, `read:user`
4. Copiez le token
5. Éditez : `%APPDATA%\Claude\claude_desktop_config.json`
6. Remplacez `""` par votre token dans `GITHUB_PERSONAL_ACCESS_TOKEN`

### Brave Search
1. Allez sur https://brave.com/search/api/
2. Créez un compte
3. Obtenez une clé API gratuite
4. Éditez : `%APPDATA%\Claude\claude_desktop_config.json`
5. Remplacez `""` par votre clé dans `BRAVE_API_KEY`

### Autres (Slack, GitLab, Google Drive)
Même principe : obtenez les tokens sur les plateformes respectives et ajoutez-les dans le fichier de configuration.

---

## 🐛 En cas de problème

### Les serveurs MCP n'apparaissent pas

**Solution :**
1. Fermez **complètement** Claude Desktop (clic droit sur l'icône > Quitter)
2. Relancez Claude Desktop
3. Allez dans Paramètres > Développeur
4. Les serveurs devraient apparaître

### Le script demande des privilèges admin

**Normal !** Le script s'élève automatiquement en admin.
- Si une fenêtre UAC apparaît, cliquez **"Oui"**
- Le script va redémarrer avec les bons privilèges

### Un outil n'est pas installé

**Solution :**
Le script affiche un rapport final avec tous les outils installés.
Si quelque chose manque, relancez simplement le script.

---

## 📁 Fichiers importants

| Fichier | Emplacement | Description |
|---------|-------------|-------------|
| **Configuration MCP** | `%APPDATA%\Claude\claude_desktop_config.json` | Config des serveurs |
| **Logs installation** | `%USERPROFILE%\.nemesis-omega\logs\` | Logs détaillés |
| **Backup config** | `%APPDATA%\Claude\*.backup.*` | Sauvegardes auto |

---

## 🔄 Réinstallation

Pour réinstaller complètement :

1. Supprimez : `%APPDATA%\Claude\claude_desktop_config.json`
2. Relancez le script : `.\NEMESIS-AUTO-INSTALL.ps1`

Le script est **idempotent** : il peut être exécuté plusieurs fois sans problème.

---

## 📊 Rapport final

À la fin, le script affiche :

```
✅ Durée totale: X secondes
✅ Étapes réussies: 30/30
✅ NodeJS: vX.X.X
✅ NPM: vX.X.X
✅ Python: X.X.X
✅ Git: X.X.X
✅ 10 serveurs MCP installés
✅ Configuration Claude valide
```

---

## 💡 Différence entre les scripts

### NEMESIS-AUTO-INSTALL.ps1 (CE SCRIPT)
- ✅ **Clic droit > Exécuter**
- ✅ Auto-élévation en admin
- ✅ Rapport final puis fermeture
- ✅ **PARFAIT POUR : Installation rapide**

### NEMESIS-MCP-ULTIMATE.ps1 (Script alternatif)
- ⚠️ Copier-coller dans PowerShell
- ⚠️ Admin manuel requis
- ✅ Monitoring continu (fenêtre reste ouverte)
- ✅ **PARFAIT POUR : Debugging et surveillance**

---

## ⚠️ Prérequis

**Aucun !** Le script installe tout automatiquement.

Juste :
- ✅ Windows 10/11
- ✅ Connexion internet
- ✅ 2 Go d'espace disque

---

## 🎯 Résumé ultra-rapide

```
1. Télécharger NEMESIS-AUTO-INSTALL.ps1
2. Clic droit > "Exécuter avec PowerShell"
3. Attendre 5-8 minutes
4. Ouvrir Claude Desktop
5. Vérifier Paramètres > Développeur
6. Profiter des serveurs MCP !
```

**C'EST TOUT !** 🚀

---

**Version :** 12.0 AUTO
**Auteur :** NEMESIS OMEGA
**Pour :** Pierre Tagnard - CGP IAE Grenoble
**Date :** Janvier 2025
