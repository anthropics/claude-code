const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Arquivo de dados
const DATA_FILE = path.join(__dirname, 'data.json');

// Funções auxiliares
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Erro ao ler dados:', error);
    }
    return {
        produtos: [],
        orcamentos: [],
        config: {
            madeira: 135,
            tratamento: 350,
            coef: 0.65,
            comp: 2.20,
            margemDesejada: 30
        }
    };
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        return false;
    }
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
    const { nome, diametro, comprimento, precoMin, precoMax } = req.body;

    // Validações
    if (!nome || !diametro || !comprimento || !precoMin || !precoMax) {
        return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    if (diametro <= 0 || comprimento <= 0 || precoMin >= precoMax) {
        return res.status(400).json({ erro: 'Valores inválidos' });
    }

    const novoProduto = {
        id: Math.max(...data.produtos.map(p => p.id), 0) + 1,
        nome,
        diametro: parseFloat(diametro),
        comprimento: parseFloat(comprimento),
        precoMin: parseFloat(precoMin),
        precoMax: parseFloat(precoMax),
        dataCriacao: new Date().toISOString()
    };

    data.produtos.push(novoProduto);
    if (writeData(data)) {
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

    const { nome, diametro, comprimento, precoMin, precoMax } = req.body;
    const produto = data.produtos[produtoIndex];

    if (nome) produto.nome = nome;
    if (diametro) produto.diametro = parseFloat(diametro);
    if (comprimento) produto.comprimento = parseFloat(comprimento);
    if (precoMin) produto.precoMin = parseFloat(precoMin);
    if (precoMax) produto.precoMax = parseFloat(precoMax);

    if (writeData(data)) {
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
        res.json({ mensagem: 'Produto removido com sucesso' });
    } else {
        res.status(500).json({ erro: 'Erro ao remover produto' });
    }
});

// ===== ROTAS ORÇAMENTOS =====
app.get('/api/orcamentos', (req, res) => {
    const data = readData();
    res.json(data.orcamentos);
});

app.post('/api/orcamentos', (req, res) => {
    const data = readData();
    const { data: dataOrc, cliente, itens } = req.body;

    if (!dataOrc || !cliente || !itens || itens.length === 0) {
        return res.status(400).json({ erro: 'Dados incompletos' });
    }

    const novoOrcamento = {
        id: 'ORC-' + Date.now(),
        data: dataOrc,
        cliente,
        itens,
        total: itens.reduce((s, i) => s + (i.qtd * i.precoUnitario), 0),
        dataCriacao: new Date().toISOString()
    };

    data.orcamentos.push(novoOrcamento);
    if (writeData(data)) {
        res.status(201).json(novoOrcamento);
    } else {
        res.status(500).json({ erro: 'Erro ao salvar orçamento' });
    }
});

app.delete('/api/orcamentos/:id', (req, res) => {
    const data = readData();
    const orcId = req.params.id;
    const orcamento = data.orcamentos.find(o => o.id === orcId);

    if (!orcamento) {
        return res.status(404).json({ erro: 'Orçamento não encontrado' });
    }

    data.orcamentos = data.orcamentos.filter(o => o.id !== orcId);
    if (writeData(data)) {
        res.json({ mensagem: 'Orçamento removido com sucesso' });
    } else {
        res.status(500).json({ erro: 'Erro ao remover orçamento' });
    }
});

// ===== ROTAS CONFIG =====
app.get('/api/config', (req, res) => {
    const data = readData();
    res.json(data.config);
});

app.put('/api/config', (req, res) => {
    const data = readData();
    const { madeira, tratamento, coef, comp, margemDesejada } = req.body;

    if (madeira) data.config.madeira = parseFloat(madeira);
    if (tratamento) data.config.tratamento = parseFloat(tratamento);
    if (coef) data.config.coef = parseFloat(coef);
    if (comp) data.config.comp = parseFloat(comp);
    if (margemDesejada) data.config.margemDesejada = parseFloat(margemDesejada);

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

    const dadosProdutos = data.produtos.map(p => ({
        ...p,
        ...calcDados(p, config)
    }));

    const custoTotalSt = config.madeira + (config.tratamento * config.coef);
    const margemMedia = dadosProdutos.length > 0 ?
        dadosProdutos.reduce((s, p) => s + p.margemMax, 0) / dadosProdutos.length : 0;
    const lucroMedio = dadosProdutos.length > 0 ?
        dadosProdutos.reduce((s, p) => s + (p.pecasSt * p.precoMax - custoTotalSt), 0) / dadosProdutos.length : 0;

    res.json({
        margemMedia,
        lucroMedio,
        custoTotalSt,
        totalProdutos: data.produtos.length,
        alertas: dadosProdutos.filter(p => p.margemMax < 15).length,
        produtos: dadosProdutos
    });
});

// ===== ROTA HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== INICIALIZAÇÃO =====
app.listen(PORT, () => {
    console.log(`🌲 Servidor Eucalipto rodando em http://localhost:${PORT}`);
    console.log(`📊 API disponível em http://localhost:${PORT}/api`);
    console.log(`🔗 Conecte o frontend em http://localhost:${PORT}`);
});
