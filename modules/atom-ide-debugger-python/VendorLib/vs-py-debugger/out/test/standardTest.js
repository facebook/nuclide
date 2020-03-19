"use strict";
// tslint:disable:no-console no-require-imports no-var-requires
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
process.env.CODE_TESTS_WORKSPACE = process.env.CODE_TESTS_WORKSPACE ? process.env.CODE_TESTS_WORKSPACE : path.join(__dirname, '..', '..', 'src', 'test');
process.env.IS_CI_SERVER_TEST_DEBUGGER = '';
process.env.VSC_PYTHON_CI_TEST = '1';
function start() {
    console.log('*'.repeat(100));
    console.log('Start Standard tests');
    require('../../node_modules/vscode/bin/test');
}
start();
//# sourceMappingURL=standardTest.js.map