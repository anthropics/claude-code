# 🚀 GUIA DE INSTALAÇÃO E SETUP - MAC

## 📍 Passo 1: Descobrir o Caminho Correto

No seu Mac, você pode estar em `/Users/andersonenside/Desktop/` ou outro local.

Para verificar:
```bash
# Abra o Terminal
pwd  # Mostra o caminho atual

# Navegue até onde está o projeto
cd ~/Desktop  # Se está na Desktop
cd ~/Documents  # Se está na pasta Documentos
```

## 📦 Passo 2: Instalar o Projeto

```bash
# Clone ou navegue até o diretório do projeto
cd /caminho/para/seu/projeto

# Instale as dependências
npm install

# Ou use yarn se preferir
yarn install
```

## 🔐 Passo 3: Configurar Google Sheets (OPCIONAL)

Se você quer sincronizar com sua planilha Google:

### 3.1 Criar Projeto no Google Cloud

1. Acesse: https://console.cloud.google.com/
2. Clique em "Selecionar projeto" → "Novo projeto"
3. Dê um nome (ex: "Eucalipto Manager")
4. Clique em "Criar"

### 3.2 Ativar Google Sheets API

1. Vá para "APIs e Serviços" → "Biblioteca"
2. Procure por "Google Sheets API"
3. Clique em "Ativar"

### 3.3 Criar API Key

1. Vá para "Credenciais"
2. Clique em "Criar Credenciais" → "Chave de API"
3. Copie a chave gerada

### 3.4 Pegar ID da Planilha

Na URL da sua planilha Google:
```
https://docs.google.com/spreadsheets/d/1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz/edit
                                      ↑ Este é o ID
```

### 3.5 Configurar .env

```bash
# Copie o arquivo exemplo
cp .env.example .env

# Edite o .env com seus valores
nano .env
# ou
code .env  # Se usar VS Code
```

Preencha:
```
GOOGLE_SHEETS_ID=seu_id_aqui
GOOGLE_API_KEY=sua_chave_api_aqui
```

## ▶️ Passo 4: Iniciar o Servidor

```bash
# Inicie o servidor
npm start

# Ou use nodemon para desenvolvimento
npm run dev
```

Você verá:
```
🌲 Servidor Eucalipto rodando em http://localhost:3000
📊 API disponível em http://localhost:3000/api
```

## 🌐 Passo 5: Abrir a Interface

No seu navegador, abra:
```
http://localhost:3000
```

Ou se quiser usar o arquivo HTML direto:
```bash
# Descubra o caminho completo
pwd
# /Users/andersonenside/seu/caminho

# Abra no navegador
open file:///Users/andersonenside/seu/caminho/eucalipto-system.html
```

## 📱 Funcionalidades Disponíveis

### ✅ Sem Google Sheets (Funciona offline)
- ✅ Dashboard com KPIs
- ✅ Gestão de produtos
- ✅ Gestão de preços
- ✅ Orçamentos
- ✅ Análise detalhada
- ✅ Configuração de custos
- ✅ Histórico de operações

### 📑 Com Google Sheets (Integração)
- 📑 Sincronizar produtos da planilha
- 📑 Exportar dados para planilha
- 📑 Manter múltiplas fontes sincronizadas

## 🔗 Endpoints da API

```
GET    http://localhost:3000/api/produtos
GET    http://localhost:3000/api/orcamentos
GET    http://localhost:3000/api/vendas
GET    http://localhost:3000/api/analise
GET    http://localhost:3000/api/relatorios/vendas
GET    http://localhost:3000/api/relatorios/margem
GET    http://localhost:3000/api/historico
GET    http://localhost:3000/api/google-sheets/status
GET    http://localhost:3000/api/health
```

## 🆘 Troubleshooting

### Erro: "Cannot find module 'express'"
```bash
npm install
```

### Erro: "Port 3000 already in use"
```bash
# Use outra porta
PORT=3001 npm start

# Ou mate o processo
lsof -i :3000
kill -9 <PID>
```

### Erro: "Cannot read file eucalipto-system.html"
```bash
# Verifique se o arquivo existe
ls -la eucalipto-system.html

# Se não existir, copie de volta
# (Verifique o caminho correto)
```

### Google Sheets retorna erro 403
- Verifique se ativou a Google Sheets API
- Verifique se a chave de API está correta
- Verifique se o ID da planilha está correto

## 📊 Estrutura de Arquivos

```
projeto/
├── eucalipto-system.html      # Interface web
├── server.js                   # Backend Node.js
├── package.json                # Dependências
├── data.json                   # Base de dados
├── .env.example                # Exemplo de configuração
├── .env                        # Configuração local (não commit)
├── README.md                   # Documentação
├── SETUP.md                    # Este arquivo
└── node_modules/               # Dependências instaladas
```

## 🎯 Próximos Passos

1. ✅ Instale as dependências: `npm install`
2. ✅ Configure Google Sheets (opcional): crie `.env`
3. ✅ Inicie o servidor: `npm start`
4. ✅ Abra http://localhost:3000 no navegador
5. ✅ Comece a usar!

## 📞 Dúvidas?

- Verifique se Node.js está instalado: `node --version`
- Verifique se npm está instalado: `npm --version`
- Consulte o README.md para mais informações
- Abra uma issue se encontrar problemas

---

**Desenvolvido com ❤️ para ENSIDE**
Data: 2025-12-16
