# DevContainer-Konfiguration

Diese Datei dokumentiert die aktuelle Konfiguration und den Zustand des DevContainers.

## Basis-Image

- Node.js 20 als Basis-Image

## Installierte Pakete

- Git, fzf, zsh, man-db, unzip, gnupg2, gh, iptables, ipset, iproute2, dnsutils, aggregate, jq
- Git Delta (für bessere diff-Anzeige)
- Global installierte Node.js-Pakete:
  - @anthropic-ai/claude-code

## VS Code-Erweiterungen

```json
"extensions": [
  "dbaeumer.vscode-eslint",
  "esbenp.prettier-vscode",
  "eamodio.gitlens",
  "aaron-bond.better-comments",
  "ms-dotnettools.vscode-dotnet-runtime",
  "ms-vscode-remote.remote-containers",
  "ms-vscode-remote.remote-wsl",
  "ms-vscode-remote.remote-ssh",
  "ms-vscode.remote-explorer"
]
```

## VS Code-Einstellungen

```json
"settings": {
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "terminal.integrated.defaultProfile.linux": "zsh",
  "terminal.integrated.profiles.linux": {
    "bash": {
      "path": "bash",
      "icon": "terminal-bash"
    },
    "zsh": {
      "path": "zsh"
    }
  }
}
```

## Persistente Volumes

- `claude-code-bashhistory`: Speichert den Befehlsverlauf
- `claude-code-config`: Speichert Konfigurationsdaten

## Shell-Konfiguration

- ZSH als Standard-Shell
- Powerline10k-Theme
- FZF-Integration für Schlüsselbindungen und Auto-Vervollständigung

## Umgebungsvariablen

```json
"remoteEnv": {
  "NODE_OPTIONS": "--max-old-space-size=4096",
  "CLAUDE_CONFIG_DIR": "/home/node/.claude",
  "POWERLEVEL9K_DISABLE_GITSTATUS": "true"
}
```

## Benutzer-Konfiguration

- Standard-Benutzer: node
- Sudo-Berechtigung für Firewall-Skript

## Sicherheitsfunktionen

- Initialisierungs-Skript für Firewall: `init-firewall.sh`
- Container mit erhöhten Netzwerkfähigkeiten: NET_ADMIN, NET_RAW
