# 🐳 GUIA DOCKER DEPLOYMENT
## Sistema Eucalipto v2.0

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Instalação do Docker](#instalação-do-docker)
4. [Quick Start (5 minutos)](#quick-start-5-minutos)
5. [Deployment Completo](#deployment-completo)
6. [Usando Docker Compose](#usando-docker-compose)
7. [Push para Docker Hub](#push-para-docker-hub)
8. [Operação em Produção](#operação-em-produção)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## 🎯 VISÃO GERAL

O Docker permite empacotar o Sistema Eucalipto em um container isolado que funciona em qualquer máquina com Docker instalado.

**Vantagens:**
- ✅ Ambiente consistente (mesma versão em dev/produção)
- ✅ Isolamento de recursos
- ✅ Escalabilidade horizontal
- ✅ Deploy rápido e previsível
- ✅ Fácil de replicar e versionar
- ✅ Compatible com Kubernetes
- ✅ CI/CD integrado

**Arquivos criados:**
- `Dockerfile` - Define imagem Docker
- `docker-compose.yml` - Orquestra múltiplos serviços
- `.dockerignore` - Arquivos a ignorar no build
- `.env.docker` - Variáveis de ambiente
- `deploy-docker.sh` - Script de automação

---

## 📦 PRÉ-REQUISITOS

✅ **Obrigatório:**
- Docker 20.10+ instalado
- Docker Compose 2.0+ instalado
- Terminal/CLI (bash, zsh, PowerShell)
- 512MB RAM mínimo

✅ **Recomendado:**
- Docker Hub account (para push de imagens)
- Credenciais Google Sheets
- 2GB RAM ou mais

✅ **Verificar instalação:**
```bash
docker --version    # Should be 20.10+
docker-compose --version  # Should be 2.0+
```

---

## 🐳 INSTALAÇÃO DO DOCKER

### **Linux (Ubuntu/Debian)**

```bash
# 1. Remover instalações antigas
sudo apt-get remove docker docker-engine docker.io containerd runc

# 2. Atualizar repositórios
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 3. Adicionar chave GPG do Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 4. Adicionar repositório Docker
echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Instalar Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 6. Adicionar seu usuário ao grupo docker (sem sudo)
sudo usermod -aG docker $USER
newgrp docker

# 7. Testar
docker run hello-world
```

### **macOS**

```bash
# 1. Instalar Homebrew (se não tiver)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Instalar Docker Desktop
brew install --cask docker

# 3. Abrir Docker Desktop
open /Applications/Docker.app

# 4. Aguardar inicialização completa
# Pode levar alguns minutos

# 5. Testar
docker run hello-world
```

### **Windows**

```powershell
# 1. Instalar Chocolatey (se não tiver)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
iwr -useb community.chocolatey.org/install.ps1 | iex

# 2. Instalar Docker Desktop
choco install docker-desktop

# 3. Reiniciar Windows
# 4. Abrir Docker Desktop
# 5. Testar
docker run hello-world
```

---

## ⚡ QUICK START (5 MINUTOS)

Copie e cole para começar imediatamente:

### **Opção 1: Usando o Script Automático**

```bash
cd /home/user/claude-code

# Tornar script executável (se necessário)
chmod +x deploy-docker.sh

# Executar workflow completo
./deploy-docker.sh full

# Ou modo interativo
./deploy-docker.sh
```

### **Opção 2: Comandos Docker Diretos**

```bash
cd /home/user/claude-code

# 1. Build da imagem
docker build -t eucalipto-system:latest .

# 2. Copiar arquivo .env
cp .env.example .env.docker
# Editar .env.docker com suas credenciais Google Sheets

# 3. Iniciar com Docker Compose
docker-compose up -d

# 4. Verificar status
docker-compose ps

# 5. Ver logs
docker-compose logs -f eucalipto

# 6. Acessar
# Abra http://localhost:3000 no navegador
```

### **Opção 3: Rodar Imagem Diretamente (sem Compose)**

```bash
docker run -d \
  --name eucalipto \
  -p 3000:3000 \
  -e GOOGLE_SHEETS_ID=seu_id \
  -e GOOGLE_API_KEY=sua_chave \
  -e NODE_ENV=production \
  eucalipto-system:latest
```

---

## 🔨 DEPLOYMENT COMPLETO

### **Passo 1: Preparar Ambiente**

```bash
cd /home/user/claude-code

# Copiar arquivo de ambiente
cp .env.example .env.docker

# Editar com seus valores
nano .env.docker
# ou
code .env.docker
```

Preencher:
```env
GOOGLE_SHEETS_ID=1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz
GOOGLE_API_KEY=sua_chave_de_api_aqui
NODE_ENV=production
PORT=3000
```

### **Passo 2: Build da Imagem**

```bash
# Build com tag latest
docker build -t eucalipto-system:latest .

# Build com versão específica
docker build -t eucalipto-system:v2.0 -t eucalipto-system:latest .

# Ver imagens criadas
docker images | grep eucalipto
```

**Esperado:**
```
eucalipto-system   latest     abc123def456   2 minutes ago   180MB
eucalipto-system   v2.0       abc123def456   2 minutes ago   180MB
```

### **Passo 3: Testar Localmente**

```bash
# Rodar container de teste
docker run -d \
  --name eucalipto-test \
  -p 3000:3000 \
  -e GOOGLE_SHEETS_ID=seu_id \
  -e GOOGLE_API_KEY=sua_chave \
  eucalipto-system:latest

# Aguardar inicialização
sleep 3

# Testar endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/produtos

# Ver logs
docker logs eucalipto-test

# Parar container de teste
docker stop eucalipto-test
docker rm eucalipto-test
```

### **Passo 4: Usar Docker Compose**

Compose facilita gerenciar múltiplos containers com um arquivo:

```bash
# Iniciar (primeiro build, depois run)
docker-compose up -d

# Ver status
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f eucalipto

# Parar containers
docker-compose stop

# Remover containers e volumes
docker-compose down -v

# Reconstruir imagem
docker-compose build --no-cache
```

---

## 🚀 USANDO DOCKER COMPOSE

### **Estrutura do docker-compose.yml:**

```yaml
services:
  eucalipto:
    build: .                    # Build do Dockerfile local
    container_name: eucalipto-system
    ports:
      - "3000:3000"             # Porta host:container
    environment:
      - GOOGLE_SHEETS_ID=...
      - GOOGLE_API_KEY=...
      - NODE_ENV=production
    volumes:
      - ./data:/app/data         # Persistência de dados
      - ./data.json:/app/data.json
    restart: unless-stopped     # Reinicia se cair
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
```

### **Comandos Úteis:**

```bash
# Iniciar tudo
docker-compose up -d

# Ver status
docker-compose ps

# Ver logs específicos
docker-compose logs eucalipto

# Ver logs com follow (tail)
docker-compose logs -f

# Executar comando dentro do container
docker-compose exec eucalipto npm list

# Reiniciar
docker-compose restart

# Parar sem remover
docker-compose stop

# Parar e remover
docker-compose down

# Remover volumes também
docker-compose down -v

# Reconstruir imagem
docker-compose build

# Build sem cache
docker-compose build --no-cache
```

---

## 📤 PUSH PARA DOCKER HUB

### **Passo 1: Criar Conta Docker Hub**

```
1. Acesse: https://hub.docker.com/signup
2. Preencha formulário
3. Confirme email
```

### **Passo 2: Fazer Login Localmente**

```bash
docker login

# Será solicitado:
# Username: seu-usuario
# Password: sua-senha
```

### **Passo 3: Fazer Tag da Imagem**

```bash
# Formato: username/repository:tag
docker tag eucalipto-system:latest seu-usuario/eucalipto-system:latest
docker tag eucalipto-system:latest seu-usuario/eucalipto-system:v2.0
```

### **Passo 4: Fazer Push**

```bash
docker push seu-usuario/eucalipto-system:latest
docker push seu-usuario/eucalipto-system:v2.0

# Ver no Docker Hub
# https://hub.docker.com/r/seu-usuario/eucalipto-system
```

### **Passo 5: Usar Imagem de Qualquer Lugar**

```bash
# Automaticamente faz pull e run
docker run -d \
  -p 3000:3000 \
  -e GOOGLE_SHEETS_ID=... \
  -e GOOGLE_API_KEY=... \
  seu-usuario/eucalipto-system:latest
```

---

## 🏭 OPERAÇÃO EM PRODUÇÃO

### **Usar Docker Compose em Produção**

```bash
# Criar pasta para dados
mkdir -p /data/eucalipto
cd /data/eucalipto

# Clonar repositório
git clone https://github.com/seu-usuario/claude-code.git
cd claude-code

# Criar .env
cat > .env << 'EOF'
GOOGLE_SHEETS_ID=seu_id
GOOGLE_API_KEY=sua_chave
NODE_ENV=production
PORT=3000
APP_PORT=3000
EOF

# Iniciar
docker-compose up -d

# Verificar
docker-compose ps
docker-compose logs
```

### **Monitoramento**

```bash
# Ver recursos em tempo real
docker stats eucalipto-system

# Ver logs contínuos
docker-compose logs -f

# Verificar saúde
docker-compose exec eucalipto curl http://localhost:3000/api/health
```

### **Backup de Dados**

```bash
# Backup do data.json
cp /data/eucalipto/data.json /backups/data-$(date +%Y%m%d-%H%M%S).json

# Backup automático (crontab)
# Adicione a ~/.crontab
0 2 * * * cp /data/eucalipto/data.json /backups/data-$(date +\%Y\%m\%d).json

# Crontab instalação
crontab -e
# Adicione linha acima
```

### **Atualizar Aplicação**

```bash
# Puxar novo código
git pull origin main

# Reconstruir imagem
docker-compose build

# Reiniciar
docker-compose up -d
```

---

## 🛠️ TROUBLESHOOTING

### **"Port 3000 already in use"**

```bash
# Mudar porta em .env
APP_PORT=3001

# Ou matar processo
lsof -i :3000
kill -9 <PID>
```

### **"Cannot connect to Docker daemon"**

```bash
# Linux: iniciar Docker
sudo systemctl start docker

# macOS: abrir Docker Desktop
open /Applications/Docker.app

# Windows: abrir Docker Desktop
# Procure no menu Iniciar
```

### **"Image build failed"**

```bash
# Limpar cache
docker build --no-cache -t eucalipto-system:latest .

# Ver output completo
docker build -v -t eucalipto-system:latest .
```

### **"Out of disk space"**

```bash
# Ver uso de disco
docker system df

# Limpar imagens não utilizadas
docker image prune -a

# Limpar volumes não utilizados
docker volume prune

# Remover tudo não utilizado
docker system prune -a
```

### **"Google Sheets API error"**

```bash
# Verificar variáveis
docker-compose config | grep GOOGLE

# Executar teste
docker-compose exec eucalipto curl \
  "https://sheets.googleapis.com/v4/spreadsheets/SEU_ID?key=SUA_CHAVE"
```

### **"Container keeps restarting"**

```bash
# Ver logs
docker-compose logs eucalipto

# Remover restart automático
docker update --restart=no eucalipto-system

# Executar com modo interativo para debug
docker run -it eucalipto-system:latest sh
```

---

## 📚 BEST PRACTICES

### **1. Segurança**

```bash
# Não comitar .env com credenciais
echo ".env" >> .gitignore
echo ".env.docker" >> .gitignore

# Usar secrets do Docker (produção)
docker secret create google_api_key -
# Digitar a chave e Ctrl+D
```

### **2. Performance**

```bash
# Usar Alpine Linux (menor imagem)
FROM node:20-alpine  # ✅ ~150MB

# vs
FROM node:20         # ❌ ~900MB
```

### **3. Versionamento**

```bash
# Sempre usar tags de versão
docker build -t eucalipto-system:v2.0 .
docker build -t eucalipto-system:latest .

# Nunca usar latest em produção crítica
# Use versões específicas:
docker run eucalipto-system:v2.0
```

### **4. Recursos**

```yaml
# Limitar recursos em docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

### **5. Logging**

```bash
# Manter logs estruturados
docker-compose logs --tail=100
docker-compose logs --since 1h

# Em produção: usar ELK Stack ou Splunk
```

### **6. CI/CD com Docker**

```yaml
# GitHub Actions example
- name: Build Docker image
  run: docker build -t eucalipto-system:${{ github.sha }} .

- name: Push to Docker Hub
  run: docker push seu-usuario/eucalipto-system:${{ github.sha }}
```

---

## 📊 REFERÊNCIA RÁPIDA

### **Build & Run:**
```bash
docker build -t eucalipto:latest .
docker run -p 3000:3000 eucalipto:latest
```

### **Compose:**
```bash
docker-compose up -d      # Iniciar
docker-compose down       # Parar
docker-compose logs -f    # Logs
```

### **Hub:**
```bash
docker push seu-usuario/eucalipto:latest
docker pull seu-usuario/eucalipto:latest
```

### **Limpeza:**
```bash
docker container prune
docker image prune
docker system prune
```

---

## 🎯 PRÓXIMOS PASSOS

Após deploy bem-sucedido:

1. ✅ Testar todos os 10 tabs
2. ✅ Verificar Google Sheets sync
3. ✅ Fazer backup dos dados
4. ✅ Configurar monitoramento
5. ✅ Documentar credenciais (em local seguro)
6. ✅ Estabelecer rotina de backup
7. ✅ Configurar alertas
8. ✅ Monitorar performance

---

## 📞 SUPORTE

**Problemas comuns:**
- Ver seção Troubleshooting acima
- Verificar logs: `docker-compose logs`
- Testar endpoint: `curl http://localhost:3000/api/health`

**Recursos úteis:**
- Docker Docs: https://docs.docker.com
- Docker Hub: https://hub.docker.com
- Docker Compose: https://docs.docker.com/compose

---

**Documento criado em:** 2025-12-17
**Versão:** 1.0
**Status:** ✅ PRONTO PARA PRODUÇÃO

