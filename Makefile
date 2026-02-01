# Creator Studio - Makefile
# Common commands for development and deployment

.PHONY: help dev dev-backend dev-frontend test build deploy-railway deploy-fly

help:
	@echo "Creator Studio - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev           - Run both backend and frontend in development mode"
	@echo "  make dev-backend   - Run backend only (Django + Celery)"
	@echo "  make dev-frontend  - Run frontend only (Next.js)"
	@echo "  make test          - Run all tests"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-dev    - Run development stack with Docker"
	@echo "  make docker-prod   - Run production stack with Docker"
	@echo "  make docker-down   - Stop all Docker containers"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-railway-api      - Deploy backend to Railway"
	@echo "  make deploy-railway-web      - Deploy frontend to Railway"
	@echo "  make deploy-fly-api          - Deploy backend to Fly.io"
	@echo "  make deploy-fly-web          - Deploy frontend to Fly.io"

# =============================================================================
# Development
# =============================================================================

dev:
	@echo "Starting development servers..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && python manage.py runserver

dev-frontend:
	cd frontend && npm run dev

dev-celery:
	cd backend && celery -A config worker -l info

# =============================================================================
# Docker
# =============================================================================

docker-dev:
	cd backend && docker-compose up -d

docker-prod:
	docker-compose -f docker-compose.prod.yml up -d --build

docker-down:
	docker-compose down
	docker-compose -f docker-compose.prod.yml down

# =============================================================================
# Testing
# =============================================================================

test:
	cd backend && python manage.py test
	cd frontend && npm run test

test-e2e:
	cd frontend && npm run test:e2e

lint:
	cd frontend && npm run lint

# =============================================================================
# Database
# =============================================================================

migrate:
	cd backend && python manage.py migrate

makemigrations:
	cd backend && python manage.py makemigrations

shell:
	cd backend && python manage.py shell

# =============================================================================
# Railway Deployment
# =============================================================================

deploy-railway-api:
	cd backend && railway up

deploy-railway-web:
	cd frontend && railway up

deploy-railway: deploy-railway-api deploy-railway-web

# =============================================================================
# Fly.io Deployment
# =============================================================================

deploy-fly-api:
	cd backend && fly deploy

deploy-fly-web:
	cd frontend && fly deploy

deploy-fly: deploy-fly-api deploy-fly-web

# =============================================================================
# Setup
# =============================================================================

setup-backend:
	cd backend && pip install -r requirements.txt
	cd backend && python manage.py migrate

setup-frontend:
	cd frontend && npm install

setup: setup-backend setup-frontend
	@echo "Setup complete! Run 'make dev' to start development servers."

# =============================================================================
# Production Build
# =============================================================================

build-frontend:
	cd frontend && npm run build

build-backend:
	cd backend && python manage.py collectstatic --noinput
