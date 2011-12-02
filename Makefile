all: test

unittests:
	node_modules/.bin/expresso -g test/unit/*_test.js

functionaltests:
	node_modules/.bin/expresso -g test/functional/*_test.js

test: unittests functionaltests

.PHONY: test