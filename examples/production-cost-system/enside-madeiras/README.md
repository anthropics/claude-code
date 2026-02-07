# Sistema de Custos de Produção - Enside Madeiras

Um sistema web interativo para cálculo e análise de custos de produção de toras de eucalipto, desenvolvido especificamente para a Enside Madeiras.

## Funcionalidades

### 📊 Custos Detalhados
- **Planejamento e Preparação**: Licenciamento ambiental, inventário florestal, planejamento de corte
- **Corte e Processamento**: Equipe de corte, combustível, manutenção, EPIs
- **Transporte Interno**: Tratorista, combustível diesel, manutenção de equipamento
- **Carregamento e Finalização**: Operador de carregadeira, combustível, amarração

Todos os valores são editáveis e os cálculos são atualizados em tempo real.

### 📈 Análise e Margens
- Configuração de custos administrativos e impostos
- Cálculo automático de margem de lucro desejada
- Formação de preço de venda sugerido
- Indicadores-chave: Markup, Lucro Líquido, Break-even
- Simulador rápido de volumes
- Análise de sensibilidade

### 🗺️ Comparativo Regional
- Análise comparativa de custos entre regiões de produção
- Impacto logístico e de frete
- Recomendações estratégicas

### 🎯 Cenários
- Simulação de cenários: Otimista, Realista, Pessimista
- Análise de viabilidade
- Cálculo de preço mínimo viável
- Volume break-even por cenário

## Como Usar

### Abrir no Navegador
1. Abra o arquivo `index.html` em um navegador web
2. Não é necessário servidor - funciona completamente offline

### Editar Valores
- Clique em qualquer campo de entrada para editar
- Os cálculos são atualizados automaticamente

### Salvar Configuração
- Use o botão "💾 Salvar Configuração" para preservar seus dados
- A configuração é salva no localStorage do navegador
- Use "📂 Carregar Última Config." para restaurá-la

### Exportar
- **PDF**: Use "📄 Gerar PDF" para imprimir ou salvar como PDF
- **Google Sheets**: Função em desenvolvimento (em breve)

### Restaurar Padrões
- Use "↩️ Restaurar Padrões" para voltar aos valores originais

## Estrutura de Custos

### Total por Categoria (exemplo com 100m³):
- **Planejamento**: R$ 3.000 (26%)
- **Corte**: R$ 3.800 (32.9%)
- **Transporte Interno**: R$ 3.240 (28.1%)
- **Carregamento**: R$ 1.496 (13%)
- **TOTAL**: R$ 11.536 = R$ 115,36/m³

## Características Técnicas

- **Responsivo**: Funciona em desktop, tablet e mobile
- **Offline-first**: Salva dados localmente no navegador
- **Sem dependências externas**: HTML, CSS e JavaScript puro
- **Performance**: Cálculos em tempo real
- **Impressora amigável**: Formatação otimizada para PDF

## Observações Importantes

⚠️ **Valores Referenciais**: Os valores apresentados são referenciais para a região de Paraibuna (SP/MG). Ajuste conforme sua realidade local.

🚫 **Não Inclusos**:
- Transporte rodoviário final
- Armazenagem prolongada
- Impostos adicionais específicos por estado/município

✅ **Obrigatório**:
- Licenciamento ambiental (CETESB/IEF)

## Dicas de Uso

1. **Economia de Escala**: Note como o custo por m³ diminui com maiores volumes
2. **Análise Sensitivity**: Entenda o impacto de variações de custo no preço final
3. **Cenários**: Use os cenários para planejamento estratégico
4. **Comparativo**: Compare com outras regiões para decisões de expansão

## Desenvolvimento Futuro

- [ ] Integração com Google Sheets
- [ ] Exportação de relatórios em PDF avançado
- [ ] Gráficos de análise visual
- [ ] Múltiplos usuários e sincronização
- [ ] Integração com banco de dados
- [ ] API REST

## Compatibilidade

- Chrome / Edge: ✅ Total
- Firefox: ✅ Total
- Safari: ✅ Total
- Internet Explorer: ❌ Não suportado

## Licença

Desenvolvido para Enside Madeiras | Enside Group
