// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-object-literal-type-assertion
const chai_1 = require("chai");
const baseLinter_1 = require("../../client/linters/baseLinter");
const mypy_1 = require("../../client/linters/mypy");
// This following is a real-world example. See gh=2380.
// tslint:disable-next-line:no-multiline-string
const output = `
provider.pyi:10: error: Incompatible types in assignment (expression has type "str", variable has type "int")
provider.pyi:11: error: Name 'not_declared_var' is not defined
`;
suite('Linting - MyPy', () => {
    test('regex', () => __awaiter(this, void 0, void 0, function* () {
        const lines = output.split('\n');
        const tests = [
            [lines[1], {
                    code: undefined,
                    message: 'Incompatible types in assignment (expression has type "str", variable has type "int")',
                    column: 0,
                    line: 10,
                    type: 'error',
                    provider: 'mypy'
                }],
            [lines[2], {
                    code: undefined,
                    message: 'Name \'not_declared_var\' is not defined',
                    column: 0,
                    line: 11,
                    type: 'error',
                    provider: 'mypy'
                }]
        ];
        for (const [line, expected] of tests) {
            const msg = baseLinter_1.parseLine(line, mypy_1.REGEX, 'mypy');
            chai_1.expect(msg).to.deep.equal(expected);
        }
    }));
});
//# sourceMappingURL=mypy.unit.test.js.map