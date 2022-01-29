all: deps lint build

deps:
	npm install
lint:
	npm run lint
build:
	npm run build
start:
	npm run start