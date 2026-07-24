# 🔐 GUIDE DE CONFIGURATION DES TOKENS MCP

## Pour activer GitHub, Brave Search et autres services

---

## 📍 Fichier à éditer

Ouvrez le fichier suivant avec un éditeur de texte (Bloc-notes, VS Code, etc.) :

```
C:\Users\pierr\AppData\Roaming\Claude\claude_desktop_config.json
```

---

## 🔑 1. GitHub Token

### Étape A : Créer le token

1. Allez sur : **https://github.com/settings/tokens**
2. Cliquez sur **"Generate new token (classic)"**
3. Donnez un nom : `Claude Desktop MCP`
4. Sélectionnez les permissions :
   - ✅ `repo` (Full control of private repositories)
   - ✅ `read:user` (Read user profile data)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Cliquez sur **"Generate token"**
6. **COPIEZ** le token immédiatement (il ne sera plus visible après)

### Étape B : Ajouter dans la config

Dans le fichier `claude_desktop_config.json`, trouvez :

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": ""
  }
}
```

Remplacez `""` par votre token :

```json
"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_VotreTOKENici123456789"
```

---

## 🔍 2. Brave Search API Key

### Étape A : Créer la clé

1. Allez sur : **https://brave.com/search/api/**
2. Cliquez sur **"Get Started"**
3. Créez un compte ou connectez-vous
4. Choisissez le plan gratuit (**Free tier** : 2000 requêtes/mois)
5. Créez une **API Key**
6. **COPIEZ** la clé

### Étape B : Ajouter dans la config

Trouvez :

```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": ""
  }
}
```

Remplacez `""` par votre clé :

```json
"BRAVE_API_KEY": "BSA_VotreCLEici123456"
```

---

## 📝 3. GitLab Token (Optionnel)

### Étape A : Créer le token

1. Allez sur : **https://gitlab.com/-/profile/personal_access_tokens**
2. Créez un token avec les permissions :
   - ✅ `read_api`
   - ✅ `read_repository`
3. **COPIEZ** le token

### Étape B : Ajouter dans la config

```json
"gitlab": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-gitlab"],
  "env": {
    "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat_VotreTokenIci"
  }
}
```

---

## 💬 4. Slack Token (Optionnel)

### Étape A : Créer l'app Slack

1. Allez sur : **https://api.slack.com/apps**
2. Cliquez sur **"Create New App"**
3. Choisissez **"From scratch"**
4. Nom de l'app : `Claude MCP`
5. Sélectionnez votre workspace
6. Allez dans **"OAuth & Permissions"**
7. Ajoutez les scopes :
   - ✅ `channels:read`
   - ✅ `chat:write`
   - ✅ `users:read`
8. Installez l'app dans votre workspace
9. **COPIEZ** le **Bot User OAuth Token** (commence par `xoxb-`)
10. Trouvez votre **Team ID** dans **"Basic Information"**

### Étape B : Ajouter dans la config

```json
"slack": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-slack"],
  "env": {
    "SLACK_BOT_TOKEN": "xoxb-VotreTokenIci",
    "SLACK_TEAM_ID": "T01234567"
  }
}
```

---

## 📁 5. Google Drive (Optionnel - Avancé)

Pour Google Drive, il faut configurer OAuth2 :

1. Allez sur : **https://console.cloud.google.com/**
2. Créez un nouveau projet
3. Activez l'**API Google Drive**
4. Créez des identifiants **OAuth 2.0**
5. Téléchargez le fichier JSON de credentials
6. Suivez la documentation : **https://developers.google.com/drive/api/quickstart/python**

---

## ✅ Après avoir modifié le fichier

### Important :

1. **Sauvegardez** le fichier `claude_desktop_config.json`
2. **Fermez complètement** Claude Desktop (clic droit > Quitter)
3. **Relancez** Claude Desktop
4. Allez dans **Paramètres > Développeur**
5. Les serveurs avec tokens devraient maintenant être actifs ✅

---

## 🔒 Sécurité

⚠️ **Ne partagez JAMAIS vos tokens !**

- Ne les commitez pas dans Git
- Ne les publiez pas en ligne
- Ne les envoyez pas par email/chat

Si vous pensez qu'un token a été compromis :
- GitHub : https://github.com/settings/tokens → Supprimez-le et recréez-en un
- Brave Search : Régénérez la clé dans votre compte
- Slack : Révoquez le token dans les paramètres de l'app

---

## 🧪 Test rapide

Après avoir ajouté les tokens, testez dans Claude :

### GitHub :
```
"Liste mes repositories GitHub"
```

### Brave Search :
```
"Recherche sur le web : meilleures pratiques Python 2024"
```

### Slack :
```
"Liste les canaux de mon workspace Slack"
```

---

## 📄 Exemple de configuration complète

Voici à quoi devrait ressembler votre fichier après configuration :

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\pierr"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_VotreTokenGitHubIci123456789"
      }
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "BSA_VotreCleAPIBraveIci123456"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/postgres"]
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "C:\\Users\\pierr\\databases"]
    }
  },
  "developerMode": true
}
```

---

## ❓ Problèmes courants

### "Le serveur ne se connecte pas après ajout du token"

1. Vérifiez que le token est entre guillemets `""`
2. Vérifiez qu'il n'y a pas d'espaces avant/après
3. Redémarrez complètement Claude Desktop

### "Erreur de syntaxe JSON"

1. Vérifiez les virgules (chaque élément sauf le dernier)
2. Utilisez un validateur JSON : https://jsonlint.com/
3. Restaurez le backup si nécessaire

### "Token invalide"

1. Vérifiez que le token n'a pas expiré
2. Vérifiez les permissions du token
3. Créez un nouveau token

---

**✨ Avec ces tokens configurés, Claude Desktop aura accès à tous vos services ! ✨**
