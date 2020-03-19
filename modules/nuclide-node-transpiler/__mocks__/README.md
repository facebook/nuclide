`nuclide-node-transpiler` is a dependency of `nuclide-jasmine`, so it cannot use `nuclide-jasmine` as a test runner.

Since some of the tests need a clean environment and some tests install the require hook, each test is run in a new node process.
