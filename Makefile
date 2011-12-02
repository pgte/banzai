all: test

unittests:
	node_modules/.bin/expresso test/unit/*_test.js

functionaltests:
	node_modules/.bin/expresso test/functional/*_test.js

test: unittests functionaltests

.PHONY: test