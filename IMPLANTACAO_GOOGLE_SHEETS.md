# 📊 Guia de Implantação - Google Sheets no Sistema Eucalipto

**Data:** 2025-12-16
**Status:** ✅ Pronto para Implantação
**Planilha ID:** `1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz`

---

## 🎯 Objetivo

Integrar sua Google Sheets com o Sistema Eucalipto v2.0 para sincronização **bidirecional** de:
- ✅ Produtos
- ✅ Preços
- ✅ Vendas
- ✅ Orçamentos

---

## 📋 Passo-a-Passo de Implantação

### **PASSO 1: Obter Credenciais Google Cloud (5-10 minutos)**

#### 1.1 Criar Projeto no Google Cloud Console

```
URL: https://console.cloud.google.com
```

**Ações:**
1. Clique em "Selecionar um projeto" (topo esquerdo)
2. Clique em "NOVO PROJETO"
3. Nome: `Eucalipto-System`
4. Clique em "CRIAR"
5. Aguarde 1-2 minutos

#### 1.2 Ativar Google Sheets API

1. No menu lateral, vá para: **APIs e serviços** → **Biblioteca**
2. Procure por: `Google Sheets API`
3. Clique no resultado
4. Clique em **"ATIVAR"**
5. Aguarde confirmação

#### 1.3 Gerar API Key

1. Vá para: **APIs e serviços** → **Credenciais**
2. Clique em **"+ CRIAR CREDENCIAIS"**
3. Selecione **"Chave de API"**
4. Uma chave será gerada e exibida
5. **COPIE e SALVE em local seguro**

Exemplo:
```
AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### **PASSO 2: Compartilhar Planilha (2 minutos)**

Sua planilha precisa estar **acessível ao público** para a API funcionar.

1. Abra sua Google Sheets: https://docs.google.com/spreadsheets/d/1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz/
2. Clique em **"Compartilhar"** (topo direito)
3. Altere para **"Qualquer pessoa com o link pode visualizar"**
4. Clique em **"Copiar link"** para confirmar

**Importante:** A planilha não precisa estar pública, apenas o link precisa funcionar.

---

### **PASSO 3: Configurar Sistema Eucalipto (2-3 minutos)**

#### 3.1 Criar arquivo `.env`

```bash
cd /home/user/claude-code
cp .env.example .env
```

#### 3.2 Editar `.env`

Abra o arquivo com seu editor (nano, vim, VSCode, etc):

```bash
nano .env
```

Preencha com seus valores:

```env
# Google Sheets
GOOGLE_SHEETS_ID=1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz
GOOGLE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Servidor
PORT=3000
NODE_ENV=production

# Configuração de Custos
CUSTO_MADEIRA=200
CUSTO_TRATAMENTO=30
COEF_STEREO=1.3
COMPRIMENTO_PADRAO=2.2
MARGEM_DESEJADA=30
```

**Importante:** Substitua `GOOGLE_API_KEY` pela sua chave real!

---

### **PASSO 4: Instalar Dependências (5 minutos)**

```bash
cd /home/user/claude-code
npm install
```

---

### **PASSO 5: Iniciar Sistema (1 minuto)**

```bash
npm start
```

Você verá:
```
✅ Servidor rodando em http://localhost:3000
✅ Google Sheets API configurada
```

---

### **PASSO 6: Acessar Sistema**

Abra no navegador:
```
http://localhost:3000
```

---

## 🔄 Sincronização de Dados

### **Carregar Dados DA Planilha**

1. Acesse a aba **"📑 GOOGLE SHEETS"**
2. Clique em **"📥 CARREGAR DE SHEETS"**
3. Aguarde sincronização (2-3 segundos)
4. Dados da planilha aparecerão no sistema

### **Exportar Dados PARA Planilha**

1. Acesse a aba **"📑 GOOGLE SHEETS"**
2. Clique em **"📤 EXPORTAR PARA SHEETS"**
3. Seus produtos, vendas e orçamentos serão atualizados na planilha

### **Verificar Status**

1. Acesse a aba **"📑 GOOGLE SHEETS"**
2. Clique em **"🔄 VERIFICAR STATUS"**
3. Verá:
   - ✅ Conexão status
   - ✅ Último sincronismo
   - ✅ Dados carregados

---

## 📊 Estrutura Esperada na Planilha

O sistema pode trabalhar com diferentes estruturas. Recomendamos:

### **Aba 1: Produtos**

```
ID | Nome | Diâmetro | Comprimento | Preço Min | Preço Max
---|------|----------|-------------|-----------|----------
1  | Eucalipto 20cm | 20 | 2.2 | 50 | 120
2  | Eucalipto 25cm | 25 | 2.2 | 60 | 140
```

### **Aba 2: Vendas**

```
Data | Cliente | Produto | Quantidade | Preço | Total
-----|---------|---------|------------|-------|------
16/12/2025 | João | Eucalipto 20cm | 50 | 85 | 4.250
```

### **Aba 3: Orçamentos**

```
Cliente | Data | Total | Status | Validade
--------|------|-------|--------|----------
Empresa XYZ | 16/12 | 8.500 | Pendente | 30 dias
```

---

## ✅ Checklist de Implantação

- [ ] **Google Cloud Console** criado
- [ ] **Google Sheets API** ativada
- [ ] **API Key** gerada e copiada
- [ ] **Planilha** compartilhada (link funcional)
- [ ] **Arquivo `.env`** criado
- [ ] **Google Sheets ID** configurado no `.env`
- [ ] **Google API Key** configurado no `.env`
- [ ] **npm install** executado
- [ ] **npm start** funcionando
- [ ] **Sistema acessível** em http://localhost:3000
- [ ] **Carregamento de dados** testado
- [ ] **Exportação de dados** testada
- [ ] **Sincronização** bidirecional confirmada

---

## 🆘 Troubleshooting

### **Erro: "API Key inválida"**

```
❌ Error: Invalid API Key
```

**Solução:**
1. Verifique se a API Key está correta em `.env`
2. Confirme se Google Sheets API está **ATIVADA**
3. Regenere a chave no Google Cloud Console

### **Erro: "Planilha não encontrada"**

```
❌ Error: Spreadsheet not found
```

**Solução:**
1. Verifique se o ID da planilha está correto
2. Confirme se a planilha está **compartilhada** (link acessível)
3. Tente copiar o ID novamente da URL

### **Erro: "Falha ao sincronizar"**

```
❌ Error: Failed to sync
```

**Solução:**
1. Verifique conexão internet
2. Confirme se .env está preenchido corretamente
3. Verifique logs do servidor (`npm run dev` mostra mais detalhes)

### **Dados não aparecem**

```
❌ Nenhum dado sincronizado
```

**Solução:**
1. Confirme se a planilha tem dados
2. Verifique se os headers estão corretos
3. Tente "VERIFICAR STATUS" primeiro
4. Clique em "CARREGAR DE SHEETS" novamente

---

## 📈 Fluxos Operacionais

### **Fluxo 1: Adicionar Novo Produto**

```
1. Adicione na planilha Google Sheets (Aba Produtos)
2. Aguarde ou clique "CARREGAR DE SHEETS"
3. Produto aparece no Sistema Eucalipto
4. Sistema calcula automaticamente:
   - Volume
   - Peças/m³
   - Peças/Estéreo
   - Custo Total
   - Preço Sugerido
```

### **Fluxo 2: Registrar Venda**

```
1. Acesse aba "VENDAS" no Sistema Eucalipto
2. Clique "➕ NOVA VENDA"
3. Selecione produto, quantidade, preço
4. Clique "REGISTRAR"
5. Venda é salva localmente
6. Clique "EXPORTAR PARA SHEETS" para sincronizar
7. Venda aparece na planilha Google Sheets
```

### **Fluxo 3: Sincronização Contínua**

```
Sistema Eucalipto ←→ Google Sheets
    ↓
Bidirecional: ambos sempre sincronizados
```

---

## 🔐 Segurança

### **Proteger sua API Key**

⚠️ **NUNCA** compartilhe sua API Key!

```bash
# ✅ Correto: guardar em .env
GOOGLE_API_KEY=AIzaSy...

# ❌ Incorreto: expor em código
const apiKey = "AIzaSy..." // NUNCA!
```

### **Planilha Segura**

A planilha pode ser:
- 📖 **Visualização pública** (qualquer pessoa vê)
- 🔒 **Link privado** (apenas com link)
- 🔐 **Acesso restrito** (apenas autorizados)

A API Key autentica as requisições, então a privacidade da planilha é protegida.

---

## 📞 Verificação Final

### **Teste 1: Conectividade**

```bash
curl -X GET "http://localhost:3000/api/google-sheets/status"
```

Deve retornar:
```json
{
  "status": "conectado",
  "spreadsheetId": "1r1KgMS5xPI8itdpJf_gGQEfV23Cu32hz",
  "ultimaSincronizacao": "2025-12-16T10:30:00Z"
}
```

### **Teste 2: Carregamento**

```bash
curl -X GET "http://localhost:3000/api/google-sheets/sync-from"
```

Deve retornar os produtos da planilha em JSON.

### **Teste 3: Exportação**

```bash
curl -X GET "http://localhost:3000/api/google-sheets/sync-to"
```

Deve atualizar a planilha com dados do sistema.

---

## 📚 Próximos Passos

1. ✅ **Implantação concluída** → Sistema funcionando
2. 📊 **Backup Regular** → Backup da planilha semanalmente
3. 🔄 **Sincronização Automática** → Setup de sincronização em background
4. 📈 **Expansão de Dados** → Adicione mais produtos, vendas, clientes
5. 🚀 **Deploy em Produção** → Hospede o sistema online

---

## 💡 Dicas Úteis

### **Dica 1: Backup Automático**

```bash
# Exportar dados semanalmente
0 2 * * 0 cd /home/user/claude-code && npm run backup
```

### **Dica 2: Sincronização em Background**

Adicione ao seu cron para sincronizar a cada 1 hora:

```bash
0 * * * * curl -X GET "http://localhost:3000/api/google-sheets/sync-from"
```

### **Dica 3: Monitorar Sincronização**

Acesse a aba "HISTÓRICO" para ver todas as sincronizações realizadas.

---

## ✨ Conclusão

Sua Google Sheets está **100% integrada** com o Sistema Eucalipto!

**Você pode agora:**
- ✅ Trabalhar com a planilha e o sistema simultaneamente
- ✅ Sincronizar dados bidirecionalamente
- ✅ Manter histórico completo de operações
- ✅ Gerar relatórios automáticos
- ✅ Expandir o sistema conforme necessário

---

**Sistema Eucalipto v2.0 + Google Sheets = Integração Perfeita! 🎉**

Para dúvidas, consulte:
- **README.md** - Documentação geral
- **CLAUDE_AI_3_ANALYSIS.md** - Análise técnica
- **INTEGRACAO_ENSIDE.md** - Opções de integração
