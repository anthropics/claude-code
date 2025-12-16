const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ===== CONFIGURAÇÃO GOOGLE SHEETS =====
// Substitua pelos seus valores de credenciais do Google Cloud
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || 'seu_id_aqui';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'sua_chave_aqui';

let sheets = null;
if (GOOGLE_SHEETS_ID && GOOGLE_API_KEY) {
    sheets = google.sheets({
        version: 'v4',
        auth: GOOGLE_API_KEY
    });
}

// Arquivo de dados local
const DATA_FILE = path.join(__dirname, 'data.json');

// ===== FUNÇÕES AUXILIARES =====
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Erro ao ler dados:', error);
    }
    return getDefaultData();
}

function getDefaultData() {
    return {
        produtos: [],
        orcamentos: [],
        vendas: [],
        config: {
            madeira: 135,
            tratamento: 350,
            coef: 0.65,
            comp: 2.20,
            margemDesejada: 30,
            frete: 15,
            manuseio: 8,
            impostos: 7
        },
        historico: [],
        clientes: []
    };
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        // Registrar no histórico
        addToHistory('Dados salvos', 'sistema');
        return true;
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        return false;
    }
}

function addToHistory(acao, usuario = 'sistema', detalhes = {}) {
    const data = readData();
    data.historico.push({
        id: 'HIST-' + Date.now(),
        timestamp: new Date().toISOString(),
        acao,
        usuario,
        detalhes
    });
    // Manter apenas últimos 1000 registros
    if (data.historico.length > 1000) {
        data.historico = data.historico.slice(-1000);
    }
    writeData(data);
}

// ===== FUNÇÕES DE CÁLCULO =====
function calcVolume(diametro, comprimento) {
    return Math.PI * Math.pow((diametro / 100) / 2, 2) * comprimento;
}

function calcDados(produto, config) {
    const comp = produto.comprimento || config.comp;
    const vol = calcVolume(produto.diametro, comp);
    const pecasM3 = Math.round(1 / vol);
    const pecasSt = Math.round(pecasM3 * config.coef);

    const custoPorPecaMadeira = config.madeira / pecasSt;
    const custoPorPecaTratamento = vol * config.tratamento;
    const custoTotal = custoPorPecaMadeira + custoPorPecaTratamento;

    const sugerido = custoTotal * (1 + config.margemDesejada / 100);
    const margemMin = ((produto.precoMin - custoTotal) / custoTotal) * 100;
    const margemMax = ((produto.precoMax - custoTotal) / custoTotal) * 100;

    return {
        volume: vol,
        pecasM3,
        pecasSt,
        custoPorPecaMadeira,
        custoPorPecaTratamento,
        custoTotal,
        sugerido,
        margemMin,
        margemMax
    };
}

// ===== GOOGLE SHEETS SYNC =====
async function syncFromGoogleSheets() {
    if (!sheets) {
        return { erro: 'Google Sheets não configurado' };
    }

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEETS_ID,
            range: 'Produtos!A:H',
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
            return { erro: 'Nenhum dado encontrado' };
        }

        const data = readData();
        const headers = rows[0];

        // Processar produtos da planilha
        data.produtos = rows.slice(1).map((row, idx) => ({
            id: idx + 1,
            nome: row[0] || '',
            diametro: parseFloat(row[1]) || 0,
            comprimento: parseFloat(row[2]) || 2.20,
            precoMin: parseFloat(row[3]) || 0,
            precoMax: parseFloat(row[4]) || 0,
            descricao: row[5] || '',
            aplicacao: row[6] || '',
            classe: row[7] || '',
            dataSincronizacao: new Date().toISOString()
        })).filter(p => p.nome);

        if (writeData(data)) {
            addToHistory('Sincronização com Google Sheets', 'sistema', {
                produtosCarregados: data.produtos.length
            });
            return {
                sucesso: true,
                mensagem: `${data.produtos.length} produtos sincronizados`,
                produtos: data.produtos
            };
        }
    } catch (error) {
        console.error('Erro ao sincronizar com Google Sheets:', error);
        return { erro: error.message };
    }
}

async function syncToGoogleSheets() {
    if (!sheets) {
        return { erro: 'Google Sheets não configurado' };
    }

    try {
        const data = readData();
        const rows = [['Bitola', 'Diâmetro', 'Comprimento', 'Preço Min', 'Preço Max', 'Descrição', 'Aplicação', 'Classe']];

        data.produtos.forEach(p => {
            rows.push([
                p.nome,
                p.diametro,
                p.comprimento,
                p.precoMin,
                p.precoMax,
                p.descricao,
                p.aplicacao,
                p.classe
            ]);
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEETS_ID,
            range: 'Produtos!A1',
            valueInputOption: 'RAW',
            resource: { values: rows }
        });

        addToHistory('Exportação para Google Sheets', 'sistema', {
            produtosExportados: data.produtos.length
        });

        return { sucesso: true, mensagem: 'Dados exportados para Google Sheets' };
    } catch (error) {
        console.error('Erro ao exportar para Google Sheets:', error);
        return { erro: error.message };
    }
}

// ===== ROTAS PRODUTOS =====
app.get('/api/produtos', (req, res) => {
    const data = readData();
    const produtosComDados = data.produtos.map(p => ({
        ...p,
        calculos: calcDados(p, data.config)
    }));
    res.json(produtosComDados);
});

app.post('/api/produtos', (req, res) => {
    const data = readData();
    const { nome, diametro, comprimento, precoMin, precoMax, descricao, aplicacao, classe } = req.body;

    if (!nome || !diametro || !comprimento || !precoMin || !precoMax) {
        return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    const novoProduto = {
        id: Math.max(...data.produtos.map(p => p.id || 0), 0) + 1,
        nome,
        diametro: parseFloat(diametro),
        comprimento: parseFloat(comprimento),
        precoMin: parseFloat(precoMin),
        precoMax: parseFloat(precoMax),
        descricao: descricao || '',
        aplicacao: aplicacao || '',
        classe: classe || '',
        dataCriacao: new Date().toISOString()
    };

    data.produtos.push(novoProduto);
    if (writeData(data)) {
        addToHistory('Produto criado', 'api', { produtoId: novoProduto.id, nome });
        res.status(201).json(novoProduto);
    } else {
        res.status(500).json({ erro: 'Erro ao salvar produto' });
    }
});

app.put('/api/produtos/:id', (req, res) => {
    const data = readData();
    const produtoId = parseInt(req.params.id);
    const produtoIndex = data.produtos.findIndex(p => p.id === produtoId);

    if (produtoIndex === -1) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    const { nome, diametro, comprimento, precoMin, precoMax, descricao, aplicacao, classe } = req.body;
    const produto = data.produtos[produtoIndex];

    if (nome) produto.nome = nome;
    if (diametro) produto.diametro = parseFloat(diametro);
    if (comprimento) produto.comprimento = parseFloat(comprimento);
    if (precoMin) produto.precoMin = parseFloat(precoMin);
    if (precoMax) produto.precoMax = parseFloat(precoMax);
    if (descricao !== undefined) produto.descricao = descricao;
    if (aplicacao !== undefined) produto.aplicacao = aplicacao;
    if (classe !== undefined) produto.classe = classe;

    if (writeData(data)) {
        addToHistory('Produto atualizado', 'api', { produtoId });
        res.json(produto);
    } else {
        res.status(500).json({ erro: 'Erro ao atualizar produto' });
    }
});

app.delete('/api/produtos/:id', (req, res) => {
    const data = readData();
    const produtoId = parseInt(req.params.id);
    const produto = data.produtos.find(p => p.id === produtoId);

    if (!produto) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    data.produtos = data.produtos.filter(p => p.id !== produtoId);
    if (writeData(data)) {
        addToHistory('Produto removido', 'api', { produtoId, nome: produto.nome });
        res.json({ mensagem: 'Produto removido com sucesso' });
    } else {
        res.status(500).json({ erro: 'Erro ao remover produto' });
    }
});

// ===== ROTAS VENDAS =====
app.get('/api/vendas', (req, res) => {
    const data = readData();
    res.json(data.vendas || []);
});

app.post('/api/vendas', (req, res) => {
    const data = readData();
    if (!data.vendas) data.vendas = [];

    const { data: dataVenda, produtoId, quantidade, unidade, precoUnitario, cliente } = req.body;

    const venda = {
        id: 'VND-' + Date.now(),
        data: dataVenda,
        produtoId: parseInt(produtoId),
        quantidade: parseFloat(quantidade),
        unidade,
        precoUnitario: parseFloat(precoUnitario),
        total: parseFloat(quantidade) * parseFloat(precoUnitario),
        cliente: cliente || 'Cliente Geral',
        dataCriacao: new Date().toISOString()
    };

    data.vendas.push(venda);
    if (writeData(data)) {
        addToHistory('Venda registrada', 'api', { vendaId: venda.id });
        res.status(201).json(venda);
    } else {
        res.status(500).json({ erro: 'Erro ao registrar venda' });
    }
});

// ===== ROTAS ORÇAMENTOS =====
app.get('/api/orcamentos', (req, res) => {
    const data = readData();
    res.json(data.orcamentos || []);
});

app.post('/api/orcamentos', (req, res) => {
    const data = readData();
    const { data: dataOrc, cliente, itens } = req.body;

    if (!dataOrc || !cliente || !itens || itens.length === 0) {
        return res.status(400).json({ erro: 'Dados incompletos' });
    }

    const orcamento = {
        id: 'ORC-' + Date.now(),
        data: dataOrc,
        cliente,
        itens,
        total: itens.reduce((s, i) => s + (i.qtd * i.precoUnitario), 0),
        dataCriacao: new Date().toISOString(),
        status: 'pendente'
    };

    data.orcamentos.push(orcamento);
    if (writeData(data)) {
        addToHistory('Orçamento criado', 'api', { orcamentoId: orcamento.id, cliente });
        res.status(201).json(orcamento);
    } else {
        res.status(500).json({ erro: 'Erro ao salvar orçamento' });
    }
});

// ===== ROTAS CONFIG =====
app.get('/api/config', (req, res) => {
    const data = readData();
    res.json(data.config);
});

app.put('/api/config', (req, res) => {
    const data = readData();
    const { madeira, tratamento, coef, comp, margemDesejada, frete, manuseio, impostos } = req.body;

    if (madeira) data.config.madeira = parseFloat(madeira);
    if (tratamento) data.config.tratamento = parseFloat(tratamento);
    if (coef) data.config.coef = parseFloat(coef);
    if (comp) data.config.comp = parseFloat(comp);
    if (margemDesejada) data.config.margemDesejada = parseFloat(margemDesejada);
    if (frete) data.config.frete = parseFloat(frete);
    if (manuseio) data.config.manuseio = parseFloat(manuseio);
    if (impostos) data.config.impostos = parseFloat(impostos);

    if (writeData(data)) {
        res.json(data.config);
    } else {
        res.status(500).json({ erro: 'Erro ao atualizar configuração' });
    }
});

// ===== ROTAS ANÁLISE =====
app.get('/api/analise', (req, res) => {
    const data = readData();
    const config = data.config;

    const dadosProdutos = (data.produtos || []).map(p => ({
        ...p,
        ...calcDados(p, config)
    }));

    const custoTotalSt = config.madeira + (config.tratamento * config.coef);
    const margemMedia = dadosProdutos.length > 0 ?
        dadosProdutos.reduce((s, p) => s + p.margemMax, 0) / dadosProdutos.length : 0;
    const lucroMedio = dadosProdutos.length > 0 ?
        dadosProdutos.reduce((s, p) => s + (p.pecasSt * p.precoMax - custoTotalSt), 0) / dadosProdutos.length : 0;

    const vendas = data.vendas || [];
    const faturamentoTotal = vendas.reduce((s, v) => s + v.total, 0);
    const custoTotalVendas = vendas.length > 0 ?
        vendas.reduce((s, v) => {
            const prod = data.produtos.find(p => p.id === v.produtoId);
            if (prod) {
                const dadosProd = calcDados(prod, config);
                return s + (v.quantidade * dadosProd.custoTotal);
            }
            return s;
        }, 0) : 0;

    res.json({
        margemMedia,
        lucroMedio,
        custoTotalSt,
        totalProdutos: (data.produtos || []).length,
        alertas: dadosProdutos.filter(p => p.margemMax < 15).length,
        faturamentoTotal,
        lucroLiquido: faturamentoTotal - custoTotalVendas,
        totalVendas: vendas.length,
        produtos: dadosProdutos
    });
});

// ===== ROTAS HISTÓRICO =====
app.get('/api/historico', (req, res) => {
    const data = readData();
    const historico = (data.historico || []).slice(-100); // Últimos 100 registros
    res.json(historico);
});

app.delete('/api/historico', (req, res) => {
    const data = readData();
    data.historico = [];
    if (writeData(data)) {
        res.json({ mensagem: 'Histórico limpo' });
    } else {
        res.status(500).json({ erro: 'Erro ao limpar histórico' });
    }
});

// ===== ROTAS GOOGLE SHEETS =====
app.get('/api/google-sheets/sync-from', async (req, res) => {
    const result = await syncFromGoogleSheets();
    if (result.erro) {
        res.status(400).json(result);
    } else {
        res.json(result);
    }
});

app.get('/api/google-sheets/sync-to', async (req, res) => {
    const result = await syncToGoogleSheets();
    if (result.erro) {
        res.status(400).json(result);
    } else {
        res.json(result);
    }
});

app.get('/api/google-sheets/status', (req, res) => {
    res.json({
        configurado: !!(GOOGLE_SHEETS_ID && GOOGLE_API_KEY),
        spreadsheetId: GOOGLE_SHEETS_ID ? '***' : 'não configurado',
        apiKey: GOOGLE_API_KEY ? '***' : 'não configurado'
    });
});

// ===== ROTAS RELATÓRIOS =====
app.get('/api/relatorios/vendas', (req, res) => {
    const data = readData();
    const vendas = data.vendas || [];

    const por_produto = {};
    vendas.forEach(v => {
        const prod = data.produtos.find(p => p.id === v.produtoId);
        const chave = prod?.nome || 'Desconhecido';
        if (!por_produto[chave]) {
            por_produto[chave] = { qtd: 0, total: 0 };
        }
        por_produto[chave].qtd += v.quantidade;
        por_produto[chave].total += v.total;
    });

    res.json({
        periodo: 'Todos os tempos',
        totalVendas: vendas.length,
        faturamentoTotal: vendas.reduce((s, v) => s + v.total, 0),
        porProduto: por_produto,
        vendas: vendas
    });
});

app.get('/api/relatorios/margem', (req, res) => {
    const data = readData();
    const config = data.config;

    const analise = (data.produtos || []).map(p => ({
        nome: p.nome,
        ...calcDados(p, config)
    })).sort((a, b) => b.margemMax - a.margemMax);

    res.json({
        margemMedia: analise.reduce((s, p) => s + p.margemMax, 0) / analise.length,
        produtos: analise
    });
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: 'JSON local',
        googleSheets: GOOGLE_SHEETS_ID ? 'configurado' : 'não configurado'
    });
});

// ===== INICIALIZAÇÃO =====
app.listen(PORT, () => {
    console.log(`🌲 Servidor Eucalipto rodando em http://localhost:${PORT}`);
    console.log(`📊 API disponível em http://localhost:${PORT}/api`);
    if (GOOGLE_SHEETS_ID && GOOGLE_API_KEY) {
        console.log(`📑 Google Sheets integrado`);
    } else {
        console.log(`⚠️  Google Sheets não configurado`);
        console.log(`   Configure GOOGLE_SHEETS_ID e GOOGLE_API_KEY em variáveis de ambiente`);
    }
});
