# 🐳 Dockerfile - Sistema Eucalipto v2.0
# Imagem otimizada para produção com Node.js Alpine

FROM node:20-alpine

# Metadados da imagem
LABEL maintainer="ENSIDE"
LABEL description="Sistema Eucalipto - Gestão de Eucalipto Tratado"
LABEL version="2.0"

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências de produção apenas
RUN npm install --production && \
    npm cache clean --force

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p /app/data && \
    mkdir -p /app/logs

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Executar aplicação
CMD ["node", "server.js"]
