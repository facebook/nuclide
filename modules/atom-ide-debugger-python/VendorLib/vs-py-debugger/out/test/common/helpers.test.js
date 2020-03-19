"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const helpers_1 = require("../../client/common/helpers");
// Defines a Mocha test suite to group tests of similar kind together
suite('helpers', () => {
    test('isNotInstalledError', done => {
        const error = new Error('something is not installed');
        assert.equal(helpers_1.isNotInstalledError(error), false, 'Standard error');
        // tslint:disable-next-line:no-any
        error.code = 'ENOENT';
        assert.equal(helpers_1.isNotInstalledError(error), true, 'ENOENT error code not detected');
        // tslint:disable-next-line:no-any
        error.code = 127;
        assert.equal(helpers_1.isNotInstalledError(error), true, '127 error code not detected');
        done();
    });
});
//# sourceMappingURL=helpers.test.js.map