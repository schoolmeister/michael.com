all: deps build

deps:
	npm install
build:
	npm run build
start:
	npm run dev