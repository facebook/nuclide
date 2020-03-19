// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const constants_1 = require("../../client/common/constants");
// Defines a Mocha test suite to group tests of similar kind together
suite('Common - Misc', () => {
    test('Ensure its identified that we\'re running unit tests', () => {
        chai_1.expect(constants_1.isTestExecution()).to.be.equal(true, 'incorrect');
    });
});
//# sourceMappingURL=misc.test.js.map