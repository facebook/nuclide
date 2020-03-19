"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
require("../../client/common/extensions");
// Defines a Mocha test suite to group tests of similar kind together
suite('String Extensions', () => {
    test('Should return empty string for empty arg', () => {
        const argTotest = '';
        chai_1.expect(argTotest.toCommandArgument()).to.be.equal('');
    });
    test('Should quote an empty space', () => {
        const argTotest = ' ';
        chai_1.expect(argTotest.toCommandArgument()).to.be.equal('" "');
    });
    test('Should not quote command arguments without spaces', () => {
        const argTotest = 'one.two.three';
        chai_1.expect(argTotest.toCommandArgument()).to.be.equal(argTotest);
    });
    test('Should quote command arguments with spaces', () => {
        const argTotest = 'one two three';
        chai_1.expect(argTotest.toCommandArgument()).to.be.equal(`"${argTotest}"`);
    });
    test('Should return empty string for empty path', () => {
        const fileToTest = '';
        chai_1.expect(fileToTest.fileToCommandArgument()).to.be.equal('');
    });
    test('Should not quote file argument without spaces', () => {
        const fileToTest = 'users/test/one';
        chai_1.expect(fileToTest.fileToCommandArgument()).to.be.equal(fileToTest);
    });
    test('Should quote file argument with spaces', () => {
        const fileToTest = 'one two three';
        chai_1.expect(fileToTest.fileToCommandArgument()).to.be.equal(`"${fileToTest}"`);
    });
    test('Should replace all back slashes with forward slashes (irrespective of OS)', () => {
        const fileToTest = 'c:\\users\\user\\conda\\scripts\\python.exe';
        chai_1.expect(fileToTest.fileToCommandArgument()).to.be.equal(fileToTest.replace(/\\/g, '/'));
    });
    test('Should replace all back slashes with forward slashes (irrespective of OS) and quoted when file has spaces', () => {
        const fileToTest = 'c:\\users\\user namne\\conda path\\scripts\\python.exe';
        chai_1.expect(fileToTest.fileToCommandArgument()).to.be.equal(`"${fileToTest.replace(/\\/g, '/')}"`);
    });
    test('Should replace all back slashes with forward slashes (irrespective of OS) and quoted when file has spaces', () => {
        const fileToTest = 'c:\\users\\user namne\\conda path\\scripts\\python.exe';
        chai_1.expect(fileToTest.fileToCommandArgument()).to.be.equal(`"${fileToTest.replace(/\\/g, '/')}"`);
    });
    test('Should leave string unchanged', () => {
        chai_1.expect('something {0}'.format()).to.be.equal('something {0}');
    });
    test('String should be formatted to contain first argument', () => {
        const formatString = 'something {0}';
        const expectedString = 'something one';
        chai_1.expect(formatString.format('one')).to.be.equal(expectedString);
    });
    test('String should be formatted to contain first argument even with too many args', () => {
        const formatString = 'something {0}';
        const expectedString = 'something one';
        chai_1.expect(formatString.format('one', 'two')).to.be.equal(expectedString);
    });
    test('String should be formatted to contain second argument', () => {
        const formatString = 'something {1}';
        const expectedString = 'something two';
        chai_1.expect(formatString.format('one', 'two')).to.be.equal(expectedString);
    });
    test('String should be formatted to contain second argument even with too many args', () => {
        const formatString = 'something {1}';
        const expectedString = 'something two';
        chai_1.expect(formatString.format('one', 'two', 'three')).to.be.equal(expectedString);
    });
    test('String should be formatted with multiple args', () => {
        const formatString = 'something {1}, {0}';
        const expectedString = 'something two, one';
        chai_1.expect(formatString.format('one', 'two', 'three')).to.be.equal(expectedString);
    });
});
//# sourceMappingURL=extensions.unit.test.js.map