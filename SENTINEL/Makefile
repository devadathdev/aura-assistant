# SENTINEL - Makefile for Common Development Tasks

.PHONY: help install dev test lint typecheck build clean db-migrate db-reset

# Default target
help:
	@echo "SENTINEL - Personal Digital Security AI"
	@echo ""
	@echo "Available targets:"
	@echo "  install        - Install all dependencies"
	@echo "  dev            - Start development environment (docker-compose)"
	@echo "  dev-api        - Start API service locally"
	@echo "  dev-web        - Start Web service locally"
	@echo "  test           - Run all tests"
	@echo "  test-api       - Run API tests"
	@echo "  test-web       - Run Web tests"
	@echo "  lint           - Run linters (ruff, eslint)"
	@echo "  typecheck      - Run type checkers (mypy, tsc)"
	@echo "  build          - Build Docker images"
	@echo "  db-migrate     - Run database migrations"
	@echo "  db-reset       - Reset database (drop and recreate)"
	@echo "  clean          - Clean build artifacts"
	@echo "  fmt            - Format code (ruff, prettier)"

# Install all dependencies
install: install-api install-web install-packages

install-packages:
	cd sentinel/packages/schemas && pip install -e .[dev]
	cd sentinel/packages/security-sdk && pip install -e .[dev]

install-api:
	cd sentinel/apps/api && pip install -e .[dev]

install-web:
	cd sentinel/apps/web && npm ci

# Development
dev:
	docker-compose up -d
	@echo "Services starting... API at http://localhost:8000, Web at http://localhost:3000"

dev-api:
	cd sentinel/apps/api && uvicorn sentinel_api.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd sentinel/apps/web && npm run dev

# Stop development environment
dev-stop:
	docker-compose down

dev-logs:
	docker-compose logs -f

# Testing
test: test-api test-web

test-api:
	cd sentinel/apps/api && pytest -v --cov=sentinel_api --cov-report=term-missing

test-web:
	cd sentinel/apps/web && npm test --if-present

# Linting
lint: lint-api lint-web lint-packages

lint-api:
	cd sentinel/apps/api && ruff check .

lint-web:
	cd sentinel/apps/web && npm run lint

lint-packages:
	cd sentinel/packages/schemas && ruff check .
	cd sentinel/packages/security-sdk && ruff check .

# Type checking
typecheck: typecheck-api typecheck-web typecheck-packages

typecheck-api:
	cd sentinel/apps/api && mypy sentinel_api --strict

typecheck-web:
	cd sentinel/apps/web && npm run type-check

typecheck-packages:
	cd sentinel/packages/schemas && mypy sentinel_schemas --strict
	cd sentinel/packages/security-sdk && mypy sentinel_security --strict

# Formatting
fmt: fmt-api fmt-web fmt-packages

fmt-api:
	cd sentinel/apps/api && ruff check --fix .

fmt-web:
	cd sentinel/apps/web && npm run prettier -- --write

fmt-packages:
	cd sentinel/packages/schemas && ruff check --fix .
	cd sentinel/packages/security-sdk && ruff check --fix .

# Building
build:
	docker-compose build

build-api:
	docker build -t sentinel-api ./sentinel/apps/api

build-web:
	docker build -t sentinel-web ./sentinel/apps/web

# Database
db-migrate:
	cd sentinel/apps/api && alembic upgrade head

db-downgrade:
	cd sentinel/apps/api && alembic downgrade -1

db-revision:
	cd sentinel/apps/api && alembic revision --autogenerate -m "$(MSG)"

db-reset:
	docker-compose exec postgres psql -U sentinel -d sentinel -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	$(MAKE) db-migrate

# Clean
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "build" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name ".coverage" -delete 2>/dev/null || true
	docker-compose down -v 2>/dev/null || true

# Security
security-scan:
	trivy fs --severity HIGH,CRITICAL .
	bandit -r sentinel/
	cd sentinel/apps/web && npm audit --audit-level=high

# Pre-commit
pre-commit: fmt lint typecheck test
	@echo "All pre-commit checks passed!"

# CI simulation
ci: lint typecheck test security-scan
	@echo "CI pipeline completed successfully!"