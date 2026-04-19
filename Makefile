.PHONY: help install install-py install-js test test-py test-js lint lint-py lint-js format format-check typecheck clean

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: install-py install-js  ## Install all dependencies

install-py:  ## Install Python dependencies
	pip install -r requirements.txt

install-js:  ## Install Node.js dependencies
	npm install

test: test-py  ## Run all tests

test-py:  ## Run Python tests
	pytest tests/ -q

lint: lint-py lint-js  ## Run all linters

lint-py:  ## Run Python linter (flake8)
	flake8 ethos_aegis/ tests/ \
		--count \
		--select=E9,F63,F7,F82 \
		--show-source \
		--statistics
	flake8 ethos_aegis/ tests/ \
		--count \
		--max-complexity=10 \
		--max-line-length=127 \
		--statistics

lint-js:  ## Run TypeScript linter (eslint)
	npm run lint

format:  ## Format all code (prettier)
	npm run format

format-check:  ## Check formatting without making changes
	npm run format:check

typecheck:  ## Type-check TypeScript
	npm run typecheck

clean:  ## Clean build artifacts
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name "*.pyo" -delete 2>/dev/null || true
	rm -rf .pytest_cache .tox dist build node_modules/.cache
