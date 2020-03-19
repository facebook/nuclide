// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any no-require-imports no-var-requires
if (Reflect.metadata === undefined) {
    require('reflect-metadata');
}
const nonUiTests_1 = require("./nonUiTests");
process.env.VSC_PYTHON_CI_TEST = '1';
process.env.VSC_PYTHON_UNIT_TEST = '1';
// this allows us to run hygiene as a git pre-commit hook or via debugger.
if (require.main === module) {
    // When running from debugger, allow custom args.
    const args = nonUiTests_1.extractParams();
    nonUiTests_1.runTests({ filePattern: '**/**.unit.test.js', grep: args.grep, timeout: args.timeout });
}
//# sourceMappingURL=unittests.js.map