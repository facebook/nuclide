// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../../../ioc/types");
const types_2 = require("../../types");
const OptionsWithArguments = ['-c', '-k', '-m', '-o', '-p', '-r', '-W',
    '--assert', '--basetemp', '--capture', '--color', '--confcutdir',
    '--cov', '--cov-config', '--cov-fail-under', '--cov-report',
    '--deselect', '--dist', '--doctest-glob',
    '--doctest-report', '--durations', '--ignore', '--import-mode',
    '--junit-prefix', '--junit-xml', '--last-failed-no-failures',
    '--lfnf', '--log-cli-date-format', '--log-cli-format',
    '--log-cli-level', '--log-date-format', '--log-file',
    '--log-file-date-format', '--log-file-format', '--log-file-level',
    '--log-format', '--log-level', '--maxfail', '--override-ini',
    '--pastebin', '--pdbcls', '--pythonwarnings', '--result-log',
    '--rootdir', '--show-capture', '--tb', '--verbosity', '--max-slave-restart',
    '--numprocesses', '--rsyncdir', '--rsyncignore', '--tx'];
const OptionsWithoutArguments = ['--cache-clear', '--cache-show', '--collect-in-virtualenv',
    '--collect-only', '--continue-on-collection-errors',
    '--cov-append', '--cov-branch', '--debug', '--disable-pytest-warnings',
    '--disable-warnings', '--doctest-continue-on-failure', '--doctest-ignore-import-errors',
    '--doctest-modules', '--exitfirst', '--failed-first', '--ff', '--fixtures',
    '--fixtures-per-test', '--force-sugar', '--full-trace', '--funcargs', '--help',
    '--keep-duplicates', '--last-failed', '--lf', '--markers', '--new-first', '--nf',
    '--no-cov', '--no-cov-on-fail',
    '--no-print-logs', '--noconftest', '--old-summary', '--pdb', '--pyargs', '-PyTest, Unittest-pyargs',
    '--quiet', '--runxfail', '--setup-only', '--setup-plan', '--setup-show', '--showlocals',
    '--strict', '--trace-config', '--verbose', '--version', '-h', '-l', '-q', '-s', '-v', '-x',
    '--boxed', '--forked', '--looponfail', '--trace', '--tx', '-d'];
let ArgumentsService = class ArgumentsService {
    constructor(serviceContainer) {
        this.helper = serviceContainer.get(types_2.IArgumentsHelper);
    }
    getKnownOptions() {
        return {
            withArgs: OptionsWithArguments,
            withoutArgs: OptionsWithoutArguments
        };
    }
    getOptionValue(args, option) {
        return this.helper.getOptionValues(args, option);
    }
    filterArguments(args, argumentToRemoveOrFilter) {
        const optionsWithoutArgsToRemove = [];
        const optionsWithArgsToRemove = [];
        // Positional arguments in pytest are test directories and files.
        // So if we want to run a specific test, then remove positional args.
        let removePositionalArgs = false;
        if (Array.isArray(argumentToRemoveOrFilter)) {
            argumentToRemoveOrFilter.forEach(item => {
                if (OptionsWithArguments.indexOf(item) >= 0) {
                    optionsWithArgsToRemove.push(item);
                }
                if (OptionsWithoutArguments.indexOf(item) >= 0) {
                    optionsWithoutArgsToRemove.push(item);
                }
            });
        }
        else {
            switch (argumentToRemoveOrFilter) {
                case types_2.TestFilter.removeTests: {
                    optionsWithoutArgsToRemove.push(...[
                        '--lf', '--last-failed',
                        '--ff', '--failed-first',
                        '--nf', '--new-first'
                    ]);
                    optionsWithArgsToRemove.push(...[
                        '-k', '-m',
                        '--lfnf', '--last-failed-no-failures'
                    ]);
                    removePositionalArgs = true;
                    break;
                }
                case types_2.TestFilter.discovery: {
                    optionsWithoutArgsToRemove.push(...[
                        '-x', '--exitfirst',
                        '--fixtures', '--funcargs',
                        '--fixtures-per-test', '--pdb',
                        '--lf', '--last-failed',
                        '--ff', '--failed-first',
                        '--nf', '--new-first',
                        '--cache-show',
                        '-v', '--verbose', '-q', '-quiet',
                        '-l', '--showlocals',
                        '--no-print-logs',
                        '--debug',
                        '--setup-only', '--setup-show', '--setup-plan', '--trace'
                    ]);
                    optionsWithArgsToRemove.push(...[
                        '-m', '--maxfail',
                        '--pdbcls', '--capture',
                        '--lfnf', '--last-failed-no-failures',
                        '--verbosity', '-r',
                        '--tb',
                        '--rootdir', '--show-capture',
                        '--durations',
                        '--junit-xml', '--junit-prefix', '--result-log',
                        '-W', '--pythonwarnings',
                        '--log-*'
                    ]);
                    removePositionalArgs = true;
                    break;
                }
                case types_2.TestFilter.debugAll:
                case types_2.TestFilter.runAll: {
                    optionsWithoutArgsToRemove.push(...['--collect-only', '--trace']);
                    break;
                }
                case types_2.TestFilter.debugSpecific:
                case types_2.TestFilter.runSpecific: {
                    optionsWithoutArgsToRemove.push(...[
                        '--collect-only',
                        '--lf', '--last-failed',
                        '--ff', '--failed-first',
                        '--nf', '--new-first',
                        '--trace'
                    ]);
                    optionsWithArgsToRemove.push(...[
                        '-k', '-m',
                        '--lfnf', '--last-failed-no-failures'
                    ]);
                    removePositionalArgs = true;
                    break;
                }
                default: {
                    throw new Error(`Unsupported Filter '${argumentToRemoveOrFilter}'`);
                }
            }
        }
        let filteredArgs = args.slice();
        if (removePositionalArgs) {
            const positionalArgs = this.helper.getPositionalArguments(filteredArgs, OptionsWithArguments, OptionsWithoutArguments);
            filteredArgs = filteredArgs.filter(item => positionalArgs.indexOf(item) === -1);
        }
        return this.helper.filterArguments(filteredArgs, optionsWithArgsToRemove, optionsWithoutArgsToRemove);
    }
    getTestFolders(args) {
        const testDirs = this.helper.getOptionValues(args, '--rootdir');
        if (typeof testDirs === 'string') {
            return [testDirs];
        }
        if (Array.isArray(testDirs) && testDirs.length > 0) {
            return testDirs;
        }
        const positionalArgs = this.helper.getPositionalArguments(args, OptionsWithArguments, OptionsWithoutArguments);
        // Positional args in pytest are files or directories.
        // Remove files from the args, and what's left are test directories.
        // If users enter test modules/methods, then its not supported.
        return positionalArgs.filter(arg => !arg.toUpperCase().endsWith('.PY'));
    }
};
ArgumentsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], ArgumentsService);
exports.ArgumentsService = ArgumentsService;
//# sourceMappingURL=argsService.js.map