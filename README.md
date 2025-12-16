# 🌲 Sistema Integrado de Eucalipto Tratado

Sistema completo de gestão de produtos, preços, cálculos de rentabilidade e geração de orçamentos para eucalipto tratado.

## ✨ Características Principais

### 📊 Dashboard Inteligente
- KPIs em tempo real (margem média, lucro/st, alertas)
- Top 3 produtos mais rentáveis
- Visualização de produtos em risco

### 📦 Gestão de Produtos
- CRUD completo de bitolas
- Suporta **comprimento variável por produto** (não apenas 2.20m)
- Cálculo automático de volume e peças/m³/st
- Validação de entrada com feedback visual

### 💰 Gestão de Preços
- Preço mínimo e máximo por produto
- Cálculo automático de margem
- Preço sugerido baseado em margem desejada
- Sugestão em massa com um clique

### 📋 Sistema de Orçamentos
- Criação de orçamentos com múltiplos itens
- Conversão automática entre unidades (peças, st, m³)
- Impressão de orçamentos
- Histórico completo

### 📈 Análise Detalhada
- Análise por estéreo
- Custos discriminados (madeira, tratamento, frete, manuseio, impostos)
- Lucro mínimo/máximo por produto
- Status visual por produto

## 🔧 Instalação

### Pré-requisitos
- Node.js 14+
- npm

### Setup

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Ou com auto-reload (desenvolvimento)
npm run dev
```

## 📊 Melhorias Implementadas

✅ **Cálculos Corrigidos**: Margens agora calculadas corretamente
✅ **Comprimento Variável**: Cada produto pode ter comprimento diferente
✅ **Múltiplos Custos**: Suporta frete, manuseio, impostos
✅ **Sistema de Orçamentos**: Completo com impressão
✅ **Backend API**: Node.js com Express
✅ **Validação**: Entrada de dados robusta
✅ **Persistência**: Dados salvos em JSON

## 🚀 Como Usar

### Adicionar Produto
1. Clique em "📦 PRODUTOS"
2. Clique em "➕ ADICIONAR"
3. Preencha bitola, diâmetro, **comprimento específico**, e preços

### Criar Orçamento
1. Clique em "📋 ORÇAMENTOS"
2. Clique em "➕ NOVO ORÇAMENTO"
3. Selecione produtos e quantidades
4. Salve e imprima

## 📁 Arquivos

- `eucalipto-system.html` - Frontend completo
- `server.js` - Backend Node.js
- `package.json` - Dependências
- `data.json` - Base de dados

## 📞 Versão

**v1.0.0** - 2025-12-16
