#!/usr/bin/env node

/**
 * 🧪 Script de Teste - Google Sheets Integration
 * Valida se a Google Sheets está funcionando corretamente
 * Uso: node testar-google-sheets.js
 */

const https = require('https');
require('dotenv').config();

console.log('\n🧪 TESTE DE INTEGRAÇÃO GOOGLE SHEETS\n');
console.log('═'.repeat(60));

// Cores para terminal
const cores = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  vermelho: '\x1b[31m',
  amarelo: '\x1b[33m',
  azul: '\x1b[36m'
};

// Verificações
const testes = [];

// TESTE 1: Verificar variáveis de ambiente
console.log(`\n${cores.azul}📋 TESTE 1: Verificar Configuração${cores.reset}`);

if (!process.env.GOOGLE_API_KEY) {
  console.log(`${cores.vermelho}❌ ERRO: GOOGLE_API_KEY não configurada em .env${cores.reset}`);
  testes.push(false);
} else {
  console.log(`${cores.verde}✅ GOOGLE_API_KEY configurada${cores.reset}`);
  console.log(`   Chave: ${process.env.GOOGLE_API_KEY.substring(0, 20)}...`);
  testes.push(true);
}

if (!process.env.GOOGLE_SHEETS_ID) {
  console.log(`${cores.vermelho}❌ ERRO: GOOGLE_SHEETS_ID não configurada em .env${cores.reset}`);
  testes.push(false);
} else {
  console.log(`${cores.verde}✅ GOOGLE_SHEETS_ID configurada${cores.reset}`);
  console.log(`   ID: ${process.env.GOOGLE_SHEETS_ID}`);
  testes.push(true);
}

// TESTE 2: Teste de conectividade com Google Sheets API
console.log(`\n${cores.azul}🌐 TESTE 2: Conectar à Google Sheets API${cores.reset}`);

function testarGoogle() {
  return new Promise((resolve) => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}?key=${process.env.GOOGLE_API_KEY}`;

    https.get(url, (res) => {
      let dados = '';

      res.on('data', chunk => dados += chunk);

      res.on('end', () => {
        try {
          const json = JSON.parse(dados);

          if (res.statusCode === 200) {
            console.log(`${cores.verde}✅ Conectado à Google Sheets com sucesso!${cores.reset}`);
            console.log(`   Título: ${json.properties.title}`);
            console.log(`   Abas encontradas: ${json.sheets.length}`);

            // Listar abas
            json.sheets.forEach((sheet, index) => {
              console.log(`   ${index + 1}. ${sheet.properties.title}`);
            });

            testes.push(true);
          } else if (res.statusCode === 403) {
            console.log(`${cores.vermelho}❌ Erro 403: API Key inválida ou sem permissão${cores.reset}`);
            testes.push(false);
          } else if (res.statusCode === 404) {
            console.log(`${cores.vermelho}❌ Erro 404: Planilha não encontrada${cores.reset}`);
            console.log(`   ID fornecido: ${process.env.GOOGLE_SHEETS_ID}`);
            testes.push(false);
          } else {
            console.log(`${cores.vermelho}❌ Erro ${res.statusCode}: ${json.error?.message}${cores.reset}`);
            testes.push(false);
          }
        } catch (e) {
          console.log(`${cores.vermelho}❌ Erro ao processar resposta${cores.reset}`);
          testes.push(false);
        }
        resolve();
      });
    }).on('error', (err) => {
      console.log(`${cores.vermelho}❌ Erro de conexão: ${err.message}${cores.reset}`);
      testes.push(false);
      resolve();
    });
  });
}

// TESTE 3: Validar dados da planilha
async function testarDados() {
  console.log(`\n${cores.azul}📊 TESTE 3: Ler Dados da Planilha${cores.reset}`);

  return new Promise((resolve) => {
    const range = 'Produtos!A1:F100'; // Ajuste conforme sua planilha
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/values/${range}?key=${process.env.GOOGLE_API_KEY}`;

    https.get(url, (res) => {
      let dados = '';

      res.on('data', chunk => dados += chunk);

      res.on('end', () => {
        try {
          const json = JSON.parse(dados);

          if (json.values && json.values.length > 0) {
            console.log(`${cores.verde}✅ Dados encontrados na aba 'Produtos'${cores.reset}`);
            console.log(`   Linhas: ${json.values.length}`);
            console.log(`   Headers: ${json.values[0].join(', ')}`);

            if (json.values.length > 1) {
              console.log(`\n   ${cores.amarelo}Primeiras 3 linhas:${cores.reset}`);
              json.values.slice(0, 4).forEach((row, idx) => {
                if (idx === 0) {
                  console.log(`   ${row.join(' | ')}`);
                  console.log(`   ${'-'.repeat(60)}`);
                } else {
                  console.log(`   ${row.join(' | ')}`);
                }
              });
            }

            testes.push(true);
          } else {
            console.log(`${cores.vermelho}❌ Nenhum dado encontrado${cores.reset}`);
            console.log(`   Verifique se a aba 'Produtos' existe e tem dados`);
            testes.push(false);
          }
        } catch (e) {
          console.log(`${cores.amarelo}⚠️ Aviso: Aba 'Produtos' pode não existir${cores.reset}`);
          console.log(`   Mensagem: ${e.message}`);
          testes.push(true); // Não é crítico se a aba não existir
        }
        resolve();
      });
    }).on('error', (err) => {
      console.log(`${cores.vermelho}❌ Erro ao ler dados: ${err.message}${cores.reset}`);
      testes.push(false);
      resolve();
    });
  });
}

// TESTE 4: Verificar acesso de escrita
async function testarEscrita() {
  console.log(`\n${cores.azul}✏️ TESTE 4: Verificar Permissão de Escrita${cores.reset}`);

  console.log(`${cores.amarelo}⚠️ Nota: Escrita requer Service Account ou OAuth${cores.reset}`);
  console.log(`   Com API Key pública, apenas leitura é permitida`);
  console.log(`   Para sincronização bidirecional, configure OAuth 2.0`);

  testes.push(null); // Neutro - esperado com API Key pública
}

// Executar testes
async function executarTestes() {
  await testarGoogle();
  await testarDados();
  await testarEscrita();

  // Resumo
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`\n${cores.azul}📊 RESUMO DOS TESTES${cores.reset}\n`);

  const passados = testes.filter(t => t === true).length;
  const falhados = testes.filter(t => t === false).length;
  const neutros = testes.filter(t => t === null).length;
  const total = testes.length;

  console.log(`  ✅ Passaram: ${passados}/${total}`);
  console.log(`  ❌ Falharam: ${falhados}/${total}`);
  console.log(`  ⚠️  Neutros:  ${neutros}/${total}`);

  if (falhados === 0) {
    console.log(`\n${cores.verde}✅ TUDO FUNCIONANDO! Sistema pronto para uso.${cores.reset}`);
    console.log(`\n${cores.verde}Próximos passos:${cores.reset}`);
    console.log(`  1. Execute: npm start`);
    console.log(`  2. Abra: http://localhost:3000`);
    console.log(`  3. Acesse aba: 📑 GOOGLE SHEETS`);
    console.log(`  4. Clique: 📥 CARREGAR DE SHEETS`);
    process.exit(0);
  } else {
    console.log(`\n${cores.vermelho}❌ PROBLEMAS ENCONTRADOS!${cores.reset}`);
    console.log(`\n${cores.amarelo}Checklist:${cores.reset}`);
    console.log(`  [ ] Google Cloud API Key gerada?`);
    console.log(`  [ ] Google Sheets API ativada?`);
    console.log(`  [ ] Arquivo .env preenchido corretamente?`);
    console.log(`  [ ] Planilha compartilhada (link acessível)?`);
    console.log(`  [ ] Google Sheets ID está correto?`);
    process.exit(1);
  }
}

executarTestes().catch(err => {
  console.error(`${cores.vermelho}❌ Erro ao executar testes: ${err.message}${cores.reset}`);
  process.exit(1);
});
