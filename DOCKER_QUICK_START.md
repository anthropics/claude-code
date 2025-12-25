# 🐳 DOCKER QUICK START
## Sistema Eucalipto v2.0 - Começar em 5 minutos

---

## ⚡ COMEÇAR AGORA

### **1. Verificar Docker**

```bash
docker --version
docker-compose --version
```

Resultado esperado:
```
Docker version 20.10.0, build abc123
Docker Compose version 2.0.0
```

Se não funcionar, [instale Docker](GUIA_DOCKER_DEPLOYMENT.md#-instalação-do-docker).

---

### **2. Preparar Credenciais**

```bash
cd /home/user/claude-code

# Copiar arquivo de ambiente
cp .env.example .env.docker

# Editar com suas credenciais Google Sheets
nano .env.docker
```

Adicionar:
```env
GOOGLE_SHEETS_ID=1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz
GOOGLE_API_KEY=sua_chave_de_api_aqui
NODE_ENV=production
```

---

### **3. Rodar com Docker Compose**

```bash
# Iniciar containers
docker-compose up -d

# Aguardar 3-5 segundos
sleep 5

# Verificar status
docker-compose ps
```

✅ **Pronto!** Acesse http://localhost:3000

---

### **4. Parar Containers**

```bash
# Parar (preserva dados)
docker-compose stop

# Parar e remover
docker-compose down

# Parar e remover TUDO (including volumes)
docker-compose down -v
```

---

## 📦 COMANDOS MAIS USADOS

| Comando | Descrição |
|---------|-----------|
| `docker-compose up -d` | Iniciar containers |
| `docker-compose down` | Parar containers |
| `docker-compose logs -f` | Ver logs em tempo real |
| `docker-compose ps` | Ver status dos containers |
| `docker-compose restart` | Reiniciar |
| `docker-compose build` | Reconstruir imagem |

---

## 🐛 PROBLEMAS?

### Container não inicia

```bash
# Ver logs
docker-compose logs eucalipto

# Debugar
docker-compose run eucalipto sh
```

### Porta 3000 em uso

```bash
# Mudar porta em .env.docker
APP_PORT=3001

# Reiniciar
docker-compose up -d
```

### Sem acesso ao Google Sheets

```bash
# Verificar variáveis
docker-compose exec eucalipto printenv | grep GOOGLE

# Testar API
docker-compose exec eucalipto curl \
  "https://sheets.googleapis.com/v4/spreadsheets/SEU_ID?key=SUA_CHAVE"
```

---

## 📊 Ver Tudo Funcionando

```bash
# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f eucalipto

# Testar API
curl http://localhost:3000/api/health

# Testar produtos
curl http://localhost:3000/api/produtos
```

---

## 🔄 Atualizar Código

```bash
# Puxar novo código
git pull origin main

# Reconstruir e reiniciar
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 💾 Backup de Dados

```bash
# Backup manual
cp data.json data.json.backup

# Em produção, fazer backup regular
# Crontab: 0 2 * * * cp /app/data.json /backups/data-$(date +%Y%m%d).json
```

---

## 🌐 PRÓXIMOS PASSOS

1. ✅ Testar localmente com Docker Compose
2. ✅ Testar todos os 10 tabs
3. ✅ Fazer backup dos dados
4. ✅ Push para Docker Hub (opcional)
5. ✅ Deploy em servidor (Heroku, VPS, AWS, etc)

---

## 📖 Guia Completo

Para instruções detalhadas, veja [GUIA_DOCKER_DEPLOYMENT.md](GUIA_DOCKER_DEPLOYMENT.md)

---

## 🚀 Deploy em Produção

```bash
# Com Docker Compose em servidor Linux:

# 1. SSH no servidor
ssh root@seu_servidor

# 2. Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Clonar repositório
git clone https://github.com/seu-usuario/claude-code
cd claude-code

# 4. Criar .env
cat > .env << 'EOF'
GOOGLE_SHEETS_ID=seu_id
GOOGLE_API_KEY=sua_chave
NODE_ENV=production
EOF

# 5. Rodar
docker-compose up -d

# 6. Configurar Nginx/SSL (opcional)
# Ver GUIA_DOCKER_DEPLOYMENT.md
```

---

**Tudo pronto! 🎉**

Sistema Eucalipto está rodando em produção com Docker! 🐳

