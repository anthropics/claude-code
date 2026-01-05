#!/bin/bash

# 🚀 Script de Deployment Docker - Sistema Eucalipto v2.0
# Facilita build, push e deploy da imagem Docker

set -e

# ===== CORES PARA OUTPUT =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ===== FUNÇÕES AUXILIARES =====
print_header() {
    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ===== VERIFICAÇÕES INICIAIS =====
check_requirements() {
    print_info "Verificando requisitos..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker não está instalado!"
        exit 1
    fi
    print_success "Docker encontrado: $(docker --version)"

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose não está instalado!"
        exit 1
    fi
    print_success "Docker Compose encontrado: $(docker-compose --version)"
}

# ===== CARREGAR VARIÁVEIS DE AMBIENTE =====
load_env() {
    if [ -f ".env.docker" ]; then
        print_info "Carregando variáveis de .env.docker..."
        export $(cat .env.docker | grep -v '^#' | xargs)
    else
        print_warning ".env.docker não encontrado!"
        print_info "Criando .env.docker padrão..."
        cp .env.docker.example .env.docker || cp .env.example .env.docker || true
    fi
}

# ===== BUILD DA IMAGEM =====
build_image() {
    print_header "🔨 BUILD DA IMAGEM DOCKER"

    IMAGE_NAME="${DOCKER_IMAGE_NAME:-eucalipto-system}"
    IMAGE_TAG="${DOCKER_IMAGE_TAG:-latest}"

    print_info "Construindo imagem: $IMAGE_NAME:$IMAGE_TAG"

    docker build \
        --tag $IMAGE_NAME:$IMAGE_TAG \
        --tag $IMAGE_NAME:latest \
        --file Dockerfile \
        .

    if [ $? -eq 0 ]; then
        print_success "Imagem construída com sucesso!"
        docker images | grep $IMAGE_NAME
    else
        print_error "Falha ao construir imagem!"
        exit 1
    fi
}

# ===== TESTAR IMAGEM LOCALMENTE =====
test_image() {
    print_header "🧪 TESTANDO IMAGEM LOCALMENTE"

    IMAGE_NAME="${DOCKER_IMAGE_NAME:-eucalipto-system}"
    CONTAINER_NAME="${CONTAINER_NAME:-eucalipto-test}"

    print_info "Parando container anterior (se existir)..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true

    print_info "Iniciando container de teste..."
    docker run -d \
        --name $CONTAINER_NAME \
        -p 3000:3000 \
        -e GOOGLE_SHEETS_ID=${GOOGLE_SHEETS_ID} \
        -e GOOGLE_API_KEY=${GOOGLE_API_KEY} \
        -e NODE_ENV=production \
        $IMAGE_NAME:latest

    sleep 2

    print_info "Verificando saúde do container..."
    if docker ps | grep -q $CONTAINER_NAME; then
        print_success "Container está rodando!"

        # Testar endpoint
        if curl -s http://localhost:3000/api/health | grep -q "health" 2>/dev/null || [ $? -eq 0 ]; then
            print_success "API respondendo corretamente!"
        else
            print_warning "API ainda não respondendo (aguarde alguns segundos)"
        fi
    else
        print_error "Container falhou ao iniciar!"
        docker logs $CONTAINER_NAME
        exit 1
    fi
}

# ===== FAZER LOGIN NO DOCKER HUB =====
docker_login() {
    print_header "🔐 LOGIN NO DOCKER HUB"

    if [ -z "$DOCKER_USERNAME" ]; then
        print_error "DOCKER_USERNAME não definido em .env.docker"
        read -p "Digite seu usuário Docker Hub: " DOCKER_USERNAME
    fi

    print_info "Fazendo login como: $DOCKER_USERNAME"
    docker login -u $DOCKER_USERNAME

    if [ $? -eq 0 ]; then
        print_success "Login realizado com sucesso!"
    else
        print_error "Falha no login!"
        exit 1
    fi
}

# ===== FAZER PUSH PARA DOCKER HUB =====
push_image() {
    print_header "📤 PUSH DA IMAGEM PARA DOCKER HUB"

    DOCKER_USERNAME="${DOCKER_USERNAME:-seu-usuario}"
    IMAGE_NAME="${DOCKER_IMAGE_NAME:-eucalipto-system}"
    IMAGE_TAG="${DOCKER_IMAGE_TAG:-latest}"

    FULL_IMAGE="$DOCKER_USERNAME/$IMAGE_NAME:$IMAGE_TAG"

    print_info "Fazendo tag da imagem: $FULL_IMAGE"
    docker tag $IMAGE_NAME:$IMAGE_TAG $FULL_IMAGE

    print_info "Fazendo push..."
    docker push $FULL_IMAGE

    if [ $? -eq 0 ]; then
        print_success "Push realizado com sucesso!"
        print_info "Imagem disponível em: https://hub.docker.com/r/$FULL_IMAGE"
    else
        print_error "Falha no push!"
        exit 1
    fi
}

# ===== INICIAR COM DOCKER COMPOSE =====
start_compose() {
    print_header "🚀 INICIANDO COM DOCKER COMPOSE"

    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml não encontrado!"
        exit 1
    fi

    print_info "Criando e iniciando containers..."
    docker-compose up -d

    if [ $? -eq 0 ]; then
        print_success "Containers iniciados com sucesso!"
        print_info "Aguarde alguns segundos para a aplicação estar pronta..."
        sleep 3

        print_header "📊 STATUS DOS CONTAINERS"
        docker-compose ps

        print_header "🌐 APLICAÇÃO PRONTA"
        print_info "URL: http://localhost:3000"
        print_info "API: http://localhost:3000/api/health"

    else
        print_error "Falha ao iniciar containers!"
        docker-compose logs
        exit 1
    fi
}

# ===== PARAR CONTAINERS =====
stop_compose() {
    print_header "🛑 PARANDO CONTAINERS"

    docker-compose down

    if [ $? -eq 0 ]; then
        print_success "Containers parados!"
    else
        print_error "Falha ao parar containers!"
        exit 1
    fi
}

# ===== LIMPAR TUDO =====
clean_all() {
    print_header "🧹 LIMPANDO TUDO"

    read -p "Tem certeza? Isto removerá containers, volumes e imagens (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        docker-compose down -v
        docker rmi ${DOCKER_IMAGE_NAME:-eucalipto-system}:latest 2>/dev/null || true
        print_success "Limpeza concluída!"
    else
        print_warning "Operação cancelada"
    fi
}

# ===== MENU PRINCIPAL =====
show_menu() {
    echo
    echo "╔════════════════════════════════════════╗"
    echo "║  🐳 Docker Deploy - Sistema Eucalipto  ║"
    echo "╚════════════════════════════════════════╝"
    echo
    echo "Opções disponíveis:"
    echo "  1) Verificar requisitos"
    echo "  2) Build da imagem"
    echo "  3) Testar imagem localmente"
    echo "  4) Fazer login no Docker Hub"
    echo "  5) Fazer push para Docker Hub"
    echo "  6) Iniciar com Docker Compose"
    echo "  7) Parar containers"
    echo "  8) Limpar tudo"
    echo "  9) Workflow completo (Build → Push → Compose)"
    echo "  0) Sair"
    echo
}

# ===== WORKFLOW COMPLETO =====
full_workflow() {
    print_header "🚀 WORKFLOW COMPLETO"

    check_requirements
    load_env
    build_image
    test_image

    read -p "Deseja fazer push para Docker Hub? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        docker_login
        push_image
    fi

    read -p "Deseja iniciar containers agora? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        start_compose
    fi

    print_success "Workflow completo finalizado!"
}

# ===== MAIN =====
main() {
    check_requirements
    load_env

    if [ $# -eq 0 ]; then
        # Modo interativo
        while true; do
            show_menu
            read -p "Escolha uma opção (0-9): " choice

            case $choice in
                1) check_requirements ;;
                2) build_image ;;
                3) test_image ;;
                4) docker_login ;;
                5) push_image ;;
                6) start_compose ;;
                7) stop_compose ;;
                8) clean_all ;;
                9) full_workflow ;;
                0) print_info "Saindo..." && exit 0 ;;
                *) print_error "Opção inválida!" ;;
            esac
        done
    else
        # Modo argumentos
        case $1 in
            build) build_image ;;
            test) test_image ;;
            login) docker_login ;;
            push) push_image ;;
            start) start_compose ;;
            stop) stop_compose ;;
            clean) clean_all ;;
            full) full_workflow ;;
            *) print_error "Comando desconhecido: $1" && exit 1 ;;
        esac
    fi
}

# Executar main
main "$@"
