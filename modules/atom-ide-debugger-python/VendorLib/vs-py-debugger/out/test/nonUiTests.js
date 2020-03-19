// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any no-require-imports no-var-requires
if (Reflect.metadata === undefined) {
    require('reflect-metadata');
}
// Custom module loader so we skip .css files that break non webpack wrapped compiles
// tslint:disable-next-line:no-var-requires no-require-imports
const Module = require('module');
// tslint:disable-next-line:no-function-expression
(function () {
    const origRequire = Module.prototype.require;
    const _require = (context, filepath) => {
        return origRequire.call(context, filepath);
    };
    Module.prototype.require = function (filepath) {
        if (filepath.endsWith('.css')) {
            return '';
        }
        // tslint:disable-next-line:no-invalid-this
        return _require(this, filepath);
    };
})();
const glob = require("glob");
const Mocha = require("mocha");
const path = require("path");
const ciConstants_1 = require("./ciConstants");
const reactHelpers_1 = require("./datascience/reactHelpers");
const vscodeMoscks = require("./vscode-mock");
process.env.VSC_PYTHON_CI_TEST = '1';
function runTests(testOptions) {
    // nteract/transforms-full expects to run in the browser so we have to fake
    // parts of the browser here.
    reactHelpers_1.setUpDomEnvironment();
    vscodeMoscks.initialize();
    const grep = testOptions ? testOptions.grep : undefined;
    const timeout = testOptions ? testOptions.timeout : undefined;
    const filePattern = testOptions ? testOptions.filePattern : '**/**.unit.test.js';
    const options = {
        ui: 'tdd',
        useColors: true,
        timeout,
        grep
    };
    let temp_mocha;
    if (ciConstants_1.MOCHA_REPORTER_JUNIT === true) {
        temp_mocha = new Mocha({
            grep: undefined,
            ui: 'tdd',
            timeout,
            reporter: ciConstants_1.MOCHA_CI_REPORTER_ID,
            reporterOptions: {
                useColors: false,
                mochaFile: ciConstants_1.MOCHA_CI_REPORTFILE,
                bail: false
            },
            slow: undefined
        });
    }
    else {
        // we are running on the command line or debugger...
        temp_mocha = new Mocha(options);
    }
    const mocha = temp_mocha;
    require('source-map-support').install();
    const testsRoot = __dirname;
    glob(filePattern, { cwd: testsRoot }, (error, files) => {
        if (error) {
            return reportErrors(error);
        }
        try {
            files.forEach(file => mocha.addFile(path.join(testsRoot, file)));
            mocha.run(failures => {
                if (failures === 0) {
                    return;
                }
                reportErrors(undefined, failures);
            });
        }
        catch (error) {
            reportErrors(error);
        }
    });
}
exports.runTests = runTests;
function reportErrors(error, failures) {
    let failed = false;
    if (error) {
        console.error(error);
        failed = true;
    }
    if (failures && failures >= 0) {
        console.error(`${failures} failed tests 👎.`);
        failed = true;
    }
    if (failed) {
        process.exit(1);
    }
}
function extractParams(defaultTimeout) {
    // When running from debugger, allow custom args.
    const args = process.argv0.length > 2 ? process.argv.slice(2) : [];
    const timeoutArgIndex = args.findIndex(arg => arg.startsWith('timeout='));
    const grepArgIndex = args.findIndex(arg => arg.startsWith('grep='));
    const timeout = timeoutArgIndex >= 0 ? parseInt(args[timeoutArgIndex].split('=')[1].trim(), 10) : defaultTimeout;
    let grep = grepArgIndex >= 0 ? args[grepArgIndex].split('=')[1].trim() : undefined;
    grep = grep && grep.length > 0 ? grep : undefined;
    return { grep: grep, timeout: timeout };
}
exports.extractParams = extractParams;
//# sourceMappingURL=nonUiTests.js.map