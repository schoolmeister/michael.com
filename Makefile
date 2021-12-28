all: deps lint build

deps:
	npm
lint:
	npm run lint
build:
	npm run build