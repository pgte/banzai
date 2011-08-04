all: test

unittests:
	expresso -g test/unit/*_test.js

functionaltests:
	expresso -g test/functional/*_test.js

test: unittests functionaltests

.PHONY: test