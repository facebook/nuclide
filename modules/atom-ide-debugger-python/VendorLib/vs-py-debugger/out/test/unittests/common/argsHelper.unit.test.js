// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:max-func-body-length no-any no-conditional-assignment no-increment-decrement no-invalid-this no-require-imports no-var-requires
const chai_1 = require("chai");
const typeMoq = require("typemoq");
const types_1 = require("../../../client/common/types");
const argumentsHelper_1 = require("../../../client/unittests/common/argumentsHelper");
const assertArrays = require('chai-arrays');
chai_1.use(assertArrays);
suite('Unit Tests - Arguments Helper', () => {
    let argsHelper;
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType();
        const logger = typeMoq.Mock.ofType();
        serviceContainer
            .setup(s => s.get(typeMoq.It.isValue(types_1.ILogger), typeMoq.It.isAny()))
            .returns(() => logger.object);
        argsHelper = new argumentsHelper_1.ArgumentsHelper(serviceContainer.object);
    });
    test('Get Option Value', () => {
        const args = ['-abc', '1234', 'zys', '--root', 'value'];
        const value = argsHelper.getOptionValues(args, '--root');
        chai_1.expect(value).to.not.be.array();
        chai_1.expect(value).to.be.deep.equal('value');
    });
    test('Get Option Value when using =', () => {
        const args = ['-abc', '1234', 'zys', '--root=value'];
        const value = argsHelper.getOptionValues(args, '--root');
        chai_1.expect(value).to.not.be.array();
        chai_1.expect(value).to.be.deep.equal('value');
    });
    test('Get Option Values', () => {
        const args = ['-abc', '1234', 'zys', '--root', 'value1', '--root', 'value2'];
        const values = argsHelper.getOptionValues(args, '--root');
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(2);
        chai_1.expect(values).to.be.deep.equal(['value1', 'value2']);
    });
    test('Get Option Values when using =', () => {
        const args = ['-abc', '1234', 'zys', '--root=value1', '--root=value2'];
        const values = argsHelper.getOptionValues(args, '--root');
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(2);
        chai_1.expect(values).to.be.deep.equal(['value1', 'value2']);
    });
    test('Get Positional options', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--no-value-option', 'value2'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(1);
        chai_1.expect(values).to.be.deep.equal(['value2']);
    });
    test('Get multiple Positional options', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--no-value-option', 'value2', 'value3'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(2);
        chai_1.expect(values).to.be.deep.equal(['value2', 'value3']);
    });
    test('Get multiple Positional options and ineline values', () => {
        const args = ['-abc=1234', '--value-option=value1', '--no-value-option', 'value2', 'value3'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(2);
        chai_1.expect(values).to.be.deep.equal(['value2', 'value3']);
    });
    test('Get Positional options with trailing value option', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(1);
        chai_1.expect(values).to.be.deep.equal(['value3']);
    });
    test('Get multiplle Positional options with trailing value option', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3', '4'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(2);
        chai_1.expect(values).to.be.deep.equal(['value3', '4']);
    });
    test('Filter to remove those with values', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3', '4'];
        const values = argsHelper.filterArguments(args, ['--value-option']);
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(4);
        chai_1.expect(values).to.be.deep.equal(['-abc', '1234', 'value3', '4']);
    });
    test('Filter to remove those without values', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--no-value-option', 'value2', 'value3', '4'];
        const values = argsHelper.filterArguments(args, [], ['--no-value-option']);
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(7);
        chai_1.expect(values).to.be.deep.equal(['-abc', '1234', '--value-option', 'value1', 'value2', 'value3', '4']);
    });
    test('Filter to remove those with and without values', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3', '4'];
        const values = argsHelper.filterArguments(args, ['--value-option'], ['-abc']);
        chai_1.expect(values).to.be.array();
        chai_1.expect(values).to.be.lengthOf(3);
        chai_1.expect(values).to.be.deep.equal(['1234', 'value3', '4']);
    });
});
//# sourceMappingURL=argsHelper.unit.test.js.map