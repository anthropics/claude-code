TESTS = test/*.js

all: test

build: clean compile

compile:
	npm install .
	npm run install

test: build
	@./node_modules/.bin/jest \
		$(TESTS)

clean:
	rm -Rf lib/bindings/


.PHONY: clean test build
