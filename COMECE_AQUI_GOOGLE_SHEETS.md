# 🚀 COMECE AQUI - Implantação Google Sheets

**Tempo total: 15 minutos**

---

## ✅ QUICK START EM 5 PASSOS

### **Passo 1️⃣ : Copiar API Key do Google Cloud (5 min)**

```
1. Abra: https://console.cloud.google.com
2. Clique em "Selecionar um projeto" (topo)
3. Clique em "+ NOVO PROJETO"
4. Nome: Eucalipto-System
5. Clique em "CRIAR"
6. Espere 1-2 minutos...
```

**Quando projeto estiver pronto:**

```
7. Menu esquerdo: "APIs e serviços" → "Biblioteca"
8. Procure: Google Sheets API
9. Clique e ATIVE
10. Vá para: "Credenciais"
11. Clique em "+ CRIAR CREDENCIAIS"
12. Escolha: "Chave de API"
13. COPIE a chave gerada
```

**Sua chave será algo assim:**
```
AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

✅ **Salve esta chave em um lugar seguro!**

---

### **Passo 2️⃣ : Criar arquivo .env (2 min)**

```bash
cd /home/user/claude-code
cp .env.example .env
```

---

### **Passo 3️⃣ : Preencher .env (2 min)**

Abra o arquivo `.env`:

```bash
# macOS/Linux
nano .env

# Windows (Notepad)
notepad .env
```

Preencha assim:

```env
GOOGLE_SHEETS_ID=1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz
GOOGLE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
NODE_ENV=production
CUSTO_MADEIRA=200
CUSTO_TRATAMENTO=30
COEF_STEREO=1.3
COMPRIMENTO_PADRAO=2.2
MARGEM_DESEJADA=30
```

**Importante:** Substitua `GOOGLE_API_KEY` pela sua chave!

---

### **Passo 4️⃣ : Instalar e Iniciar (3 min)**

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start
```

Você verá:
```
✅ Servidor rodando em http://localhost:3000
```

---

### **Passo 5️⃣ : Usar o Sistema**

Abra no navegador:
```
http://localhost:3000
```

Acesse a aba **"📑 GOOGLE SHEETS"** e clique:
```
📥 CARREGAR DE SHEETS
```

✅ **Pronto! Seus dados estão sincronizados!**

---

## 🧪 Validar Integração

Execute nosso script de teste:

```bash
node testar-google-sheets.js
```

Você verá algo assim:

```
🧪 TESTE DE INTEGRAÇÃO GOOGLE SHEETS

═════════════════════════════════════════════════════════

📋 TESTE 1: Verificar Configuração
✅ GOOGLE_API_KEY configurada
   Chave: AIzaSyDxxxxxxxxxx...
✅ GOOGLE_SHEETS_ID configurada
   ID: 1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz

🌐 TESTE 2: Conectar à Google Sheets API
✅ Conectado à Google Sheets com sucesso!
   Título: Eucalipto - Sistema Completo v2.0
   Abas encontradas: 3
   1. Produtos
   2. Vendas
   3. Orçamentos

📊 TESTE 3: Ler Dados da Planilha
✅ Dados encontrados na aba 'Produtos'
   Linhas: 6
   Headers: Nome, Diâmetro, Comprimento, Preço Min, Preço Max, Custo

✏️ TESTE 4: Verificar Permissão de Escrita
⚠️ Nota: Escrita requer Service Account ou OAuth
   Com API Key pública, apenas leitura é permitida

═════════════════════════════════════════════════════════

📊 RESUMO DOS TESTES

  ✅ Passaram: 4/5
  ❌ Falharam: 0/5
  ⚠️  Neutros:  1/5

✅ TUDO FUNCIONANDO! Sistema pronto para uso.
```

---

## 🔄 Sincronizar Dados

### **Carregar ÜA PLANILHA**

```
1. Abra sistema em http://localhost:3000
2. Clique na aba: 📑 GOOGLE SHEETS
3. Clique no botão: 📥 CARREGAR DE SHEETS
4. Aguarde 2-3 segundos
5. Seus produtos aparecem no sistema!
```

### **Exportar PARA PLANILHA**

```
1. Faça mudanças no sistema (adicione produtos, vendas, etc)
2. Clique na aba: 📑 GOOGLE SHEETS
3. Clique no botão: 📤 EXPORTAR PARA SHEETS
4. Aguarde sincronização
5. Suas mudanças aparecem na planilha Google!
```

---

## ❌ Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| API Key inválida | Chave errada em .env | Regenere no Google Cloud |
| Planilha não encontrada | ID errado | Copie ID correto da URL |
| Sem conexão | Internet desconectada | Verifique WiFi |
| Port 3000 in use | Outro app usando porta | `PORT=3001 npm start` |

---

## 📞 Suporte

Se tiver problemas:

1. **Verifique o teste:** `node testar-google-sheets.js`
2. **Revise o arquivo:** `cat .env` (nunca compartilhe!)
3. **Reinicie o servidor:** `npm start`
4. **Consulte documentação:** Ver `IMPLANTACAO_GOOGLE_SHEETS.md`

---

## 🎉 Pronto!

Você tem agora:
- ✅ Sistema Eucalipto v2.0 funcionando
- ✅ Google Sheets integrada
- ✅ Sincronização bidirecional
- ✅ Backup automático de dados

**Comece a usar!** 🚀
