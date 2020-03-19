## Outline test fixtures

There are several files used to test the `astToOutline` function. The AST for each file is committed
so the tests do not depend on Flow to run.

For each file `foo.js`, the associated AST file is `foo-ast.json`. Whenever you make changes to a JS
file, you must regenerate the ast file by running `flow ast --pretty < foo.js > foo-ast.json`.
