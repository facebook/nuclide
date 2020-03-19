// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tslint:disable:no-require-imports no-var-requires import-name no-function-expression no-any prefer-template no-console no-var-self
// Most of the source is in node_modules/vscode/lib/testrunner.js
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const glob = require("glob");
const istanbul = require("istanbul");
const Mocha = require("mocha");
const path = require("path");
const remapIstanbul = require('remap-istanbul');
const reactHelpers_1 = require("./datascience/reactHelpers");
// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY.
// Since we are not running in a tty environment, we just implement the method statically.
const tty = require('tty');
if (!tty.getWindowSize) {
    tty.getWindowSize = function () { return [80, 75]; };
}
let mocha = new Mocha({
    ui: 'tdd',
    useColors: true
});
let testFilesGlob = 'test';
let coverageOptions;
function configure(setupOptions, coverageOpts) {
    if (setupOptions.testFilesSuffix) {
        testFilesGlob = setupOptions.testFilesSuffix;
    }
    mocha = new Mocha(setupOptions);
    coverageOptions = coverageOpts;
}
exports.configure = configure;
function run(testsRoot, callback) {
    // Enable source map support.
    require('source-map-support').install();
    // nteract/transforms-full expects to run in the browser so we have to fake
    // parts of the browser here.
    reactHelpers_1.setUpDomEnvironment();
    // Check whether code coverage is enabled.
    const options = getCoverageOptions(testsRoot);
    if (options && options.enabled) {
        // Setup coverage pre-test, including post-test hook to report.
        // tslint:disable-next-line:no-use-before-declare
        const coverageRunner = new CoverageRunner(options, testsRoot, callback);
        coverageRunner.setupCoverage();
    }
    // Run the tests.
    glob(`**/**.${testFilesGlob}.js`, { ignore: ['**/**.unit.test.js', '**/**.functional.test.js'], cwd: testsRoot }, (error, files) => {
        if (error) {
            return callback(error);
        }
        try {
            files.forEach(file => mocha.addFile(path.join(testsRoot, file)));
            mocha.run((failures) => callback(undefined, failures));
        }
        catch (error) {
            return callback(error);
        }
    });
}
exports.run = run;
function getCoverageOptions(testsRoot) {
    if (!coverageOptions) {
        return undefined;
    }
    const coverConfigPath = path.join(testsRoot, coverageOptions.coverageConfig);
    return fs.existsSync(coverConfigPath) ? JSON.parse(fs.readFileSync(coverConfigPath, 'utf8')) : undefined;
}
class CoverageRunner {
    constructor(options, testsRoot, endRunCallback) {
        this.options = options;
        this.testsRoot = testsRoot;
        this.coverageVar = `$$cov_${new Date().getTime()}$$`;
        this.sourceFiles = [];
        if (!options.relativeSourcePath) {
            endRunCallback(new Error('Error - relativeSourcePath must be defined for code coverage to work'));
        }
    }
    get coverage() {
        if (global[this.coverageVar] === undefined || Object.keys(global[this.coverageVar]).length === 0) {
            console.error('No coverage information was collected, exit without writing coverage information');
            return {};
        }
        else {
            return global[this.coverageVar];
        }
    }
    set coverage(value) {
        global[this.coverageVar] = value;
    }
    /**
     * Information on hooking up code coverage can be found here:
     * http://tannguyen.org/2017/04/gulp-mocha-and-istanbul/
     * http://gotwarlost.github.io/istanbul/public/apidocs/classes/HookOptions.html
     * @memberof CoverageRunner
     */
    setupCoverage() {
        const reportingDir = path.join(this.testsRoot, this.options.relativeCoverageDir);
        fs.emptyDirSync(reportingDir);
        // Set up Code Coverage, hooking require so that instrumented code is returned.
        this.instrumenter = new istanbul.Instrumenter({ coverageVariable: this.coverageVar });
        const sourceRoot = path.join(this.testsRoot, this.options.relativeSourcePath);
        // Glob source files
        const srcFiles = glob.sync('**/**.js', {
            ignore: this.options.ignorePatterns,
            cwd: sourceRoot
        });
        // Create a match function - taken from the run-with-cover.js in istanbul.
        const decache = require('decache');
        const fileMap = new Set();
        srcFiles
            .map(file => path.join(sourceRoot, file))
            .forEach(fullPath => {
            fileMap.add(fullPath);
            // On Windows, extension is loaded pre-test hooks and this mean we lose
            // our chance to hook the Require call. In order to instrument the code
            // we have to decache the JS file so on next load it gets instrumented.
            // This doesn't impact tests, but is a concern if we had some integration
            // tests that relied on VSCode accessing our module since there could be
            // some shared global state that we lose.
            decache(fullPath);
        });
        const matchFn = (file) => fileMap.has(file);
        this.sourceFiles = Array.from(fileMap.keys());
        // http://gotwarlost.github.io/istanbul/public/apidocs/classes/Hook.html#method_hookRequire.
        // Hook up to the Require function so that when this is called, if any of our source files
        // are required, the instrumented version is pulled in instead. These instrumented versions
        // write to a global coverage variable with hit counts whenever they are accessed.
        const transformer = this.instrumenter.instrumentSync.bind(this.instrumenter);
        const hookOpts = { verbose: false, extensions: ['.js'] };
        istanbul.hook.hookRequire(matchFn, transformer, hookOpts);
        // Initialize the global variable to store instrumentation details.
        // http://gotwarlost.github.io/istanbul/public/apidocs/classes/Instrumenter.html.
        this.coverage = {};
        // Hook the process exit event to handle reporting,
        // Only report coverage if the process is exiting successfully.
        process.on('exit', () => this.reportCoverage());
    }
    /**
     * Writes a coverage report. Note that as this is called in the process exit callback, all calls must be synchronous.
     * @returns {void}
     * @memberOf CoverageRunner
     */
    reportCoverage() {
        istanbul.hook.unhookRequire();
        const coverage = this.coverage;
        // Files that are not touched by code ran by the test runner is manually instrumented, to
        // illustrate the missing coverage.
        this.sourceFiles
            .filter(file => !coverage[file])
            .forEach(file => {
            this.instrumenter.instrumentSync(fs.readFileSync(file, 'utf-8'), file);
            // When instrumenting the code, istanbul will give each FunctionDeclaration a value of 1 in coverState.s,
            // presumably to compensate for function hoisting. We need to reset this, as the function was not hoisted,
            // as it was never loaded.
            Object.keys(this.instrumenter.coverState.s).forEach(key => this.instrumenter.coverState.s[key] = 0);
            coverage[file] = this.instrumenter.coverState;
        });
        const reportingDir = path.join(this.testsRoot, this.options.relativeCoverageDir);
        const coverageFile = path.join(reportingDir, 'coverage.json');
        fs.mkdirsSync(reportingDir);
        fs.writeFileSync(coverageFile, JSON.stringify(coverage), 'utf8');
        const remappedCollector = remapIstanbul.remap(coverage, {
            warn: warning => {
                // We expect some warnings as any JS file without a typescript mapping will cause this.
                // By default, we'll skip printing these to the console as it clutters it up.
                if (this.options.verbose) {
                    console.warn(warning);
                }
            }
        });
        const reporter = new istanbul.Reporter(undefined, reportingDir);
        const reportTypes = Array.isArray(this.options.reports) ? this.options.reports : ['lcov'];
        reporter.addAll(reportTypes);
        reporter.write(remappedCollector, true, () => console.log(`reports written to ${reportingDir}`));
    }
}
//# sourceMappingURL=testRunner.js.map