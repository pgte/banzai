all: test

unittests:
	expresso -g test/unit/*_test.js

test: unittests

.PHONY: test