// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const path = require("path");
const TypeMoq = require("typemoq");
// tslint:disable-next-line:no-require-imports
const untildify = require("untildify");
const configSettings_1 = require("../../client/common/configSettings");
const misc_1 = require("../../client/common/utils/misc");
// tslint:disable-next-line:max-func-body-length
suite('Python Settings', () => {
    let config;
    let expected;
    let settings;
    const CustomPythonSettings = class extends configSettings_1.PythonSettings {
        initialize() { misc_1.noop(); }
    };
    setup(() => {
        config = TypeMoq.Mock.ofType(undefined, TypeMoq.MockBehavior.Strict);
        expected = new CustomPythonSettings();
        settings = new CustomPythonSettings();
    });
    function initializeConfig(sourceSettings) {
        // string settings
        for (const name of ['pythonPath', 'venvPath', 'condaPath', 'envFile']) {
            config.setup(c => c.get(name))
                .returns(() => sourceSettings[name]);
        }
        if (sourceSettings.jediEnabled) {
            config.setup(c => c.get('jediPath'))
                .returns(() => sourceSettings.jediPath);
        }
        for (const name of ['venvFolders']) {
            config.setup(c => c.get(name))
                .returns(() => sourceSettings[name]);
        }
        // boolean settings
        for (const name of ['downloadLanguageServer', 'jediEnabled', 'autoUpdateLanguageServer']) {
            config.setup(c => c.get(name, true))
                .returns(() => sourceSettings[name]);
        }
        for (const name of ['disableInstallationCheck', 'globalModuleInstallation']) {
            config.setup(c => c.get(name))
                .returns(() => sourceSettings[name]);
        }
        // number settings
        if (sourceSettings.jediEnabled) {
            config.setup(c => c.get('jediMemoryLimit'))
                .returns(() => sourceSettings.jediMemoryLimit);
        }
        // "any" settings
        // tslint:disable-next-line:no-any
        config.setup(c => c.get('devOptions'))
            .returns(() => sourceSettings.devOptions);
        // complex settings
        config.setup(c => c.get('linting'))
            .returns(() => sourceSettings.linting);
        config.setup(c => c.get('analysis'))
            .returns(() => sourceSettings.analysis);
        config.setup(c => c.get('sortImports'))
            .returns(() => sourceSettings.sortImports);
        config.setup(c => c.get('formatting'))
            .returns(() => sourceSettings.formatting);
        config.setup(c => c.get('autoComplete'))
            .returns(() => sourceSettings.autoComplete);
        config.setup(c => c.get('workspaceSymbols'))
            .returns(() => sourceSettings.workspaceSymbols);
        config.setup(c => c.get('unitTest'))
            .returns(() => sourceSettings.unitTest);
        config.setup(c => c.get('terminal'))
            .returns(() => sourceSettings.terminal);
        config.setup(c => c.get('dataScience'))
            .returns(() => sourceSettings.datascience);
    }
    test('condaPath updated', () => {
        expected.pythonPath = 'python3';
        expected.condaPath = 'spam';
        initializeConfig(expected);
        config.setup(c => c.get('condaPath'))
            .returns(() => expected.condaPath)
            .verifiable(TypeMoq.Times.once());
        settings.update(config.object);
        chai_1.expect(settings.condaPath).to.be.equal(expected.condaPath);
        config.verifyAll();
    });
    test('condaPath (relative to home) updated', () => {
        expected.pythonPath = 'python3';
        expected.condaPath = path.join('~', 'anaconda3', 'bin', 'conda');
        initializeConfig(expected);
        config.setup(c => c.get('condaPath'))
            .returns(() => expected.condaPath)
            .verifiable(TypeMoq.Times.once());
        settings.update(config.object);
        chai_1.expect(settings.condaPath).to.be.equal(untildify(expected.condaPath));
        config.verifyAll();
    });
    test('Formatter Paths and args', () => {
        expected.pythonPath = 'python3';
        // tslint:disable-next-line:no-any
        expected.formatting = {
            autopep8Args: ['1', '2'], autopep8Path: 'one',
            blackArgs: ['3', '4'], blackPath: 'two',
            yapfArgs: ['5', '6'], yapfPath: 'three',
            provider: ''
        };
        expected.formatting.blackPath = 'spam';
        initializeConfig(expected);
        config.setup(c => c.get('formatting'))
            .returns(() => expected.formatting)
            .verifiable(TypeMoq.Times.once());
        settings.update(config.object);
        for (const key of Object.keys(expected.formatting)) {
            chai_1.expect(settings.formatting[key]).to.be.deep.equal(expected.formatting[key]);
        }
        config.verifyAll();
    });
    test('Formatter Paths (paths relative to home)', () => {
        expected.pythonPath = 'python3';
        // tslint:disable-next-line:no-any
        expected.formatting = {
            autopep8Args: [], autopep8Path: path.join('~', 'one'),
            blackArgs: [], blackPath: path.join('~', 'two'),
            yapfArgs: [], yapfPath: path.join('~', 'three'),
            provider: ''
        };
        expected.formatting.blackPath = 'spam';
        initializeConfig(expected);
        config.setup(c => c.get('formatting'))
            .returns(() => expected.formatting)
            .verifiable(TypeMoq.Times.once());
        settings.update(config.object);
        for (const key of Object.keys(expected.formatting)) {
            if (!key.endsWith('path')) {
                continue;
            }
            const expectedPath = untildify(expected.formatting[key]);
            chai_1.expect(settings.formatting[key]).to.be.equal(expectedPath);
        }
        config.verifyAll();
    });
});
//# sourceMappingURL=configSettings.unit.test.js.map