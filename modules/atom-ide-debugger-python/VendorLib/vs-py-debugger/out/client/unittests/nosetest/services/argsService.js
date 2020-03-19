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
const OptionsWithArguments = ['--attr', '--config', '--cover-html-dir', '--cover-min-percentage',
    '--cover-package', '--cover-xml-file', '--debug', '--debug-log', '--doctest-extension',
    '--doctest-fixtures', '--doctest-options', '--doctest-result-variable', '--eval-attr',
    '--exclude', '--id-file', '--ignore-files', '--include', '--log-config', '--logging-config',
    '--logging-datefmt', '--logging-filter', '--logging-format', '--logging-level', '--match',
    '--process-timeout', '--processes', '--py3where', '--testmatch', '--tests', '--verbosity',
    '--where', '--xunit-file', '--xunit-testsuite-name',
    '-A', '-a', '-c', '-e', '-i', '-I', '-l', '-m', '-w',
    '--profile-restrict', '--profile-sort', '--profile-stats-file'];
const OptionsWithoutArguments = ['-h', '--help', '-V', '--version', '-p', '--plugins',
    '-v', '--verbose', '--quiet', '-x', '--stop', '-P', '--no-path-adjustment',
    '--exe', '--noexe', '--traverse-namespace', '--first-package-wins', '--first-pkg-wins',
    '--1st-pkg-wins', '--no-byte-compile', '-s', '--nocapture', '--nologcapture',
    '--logging-clear-handlers', '--with-coverage', '--cover-erase', '--cover-tests',
    '--cover-inclusive', '--cover-html', '--cover-branches', '--cover-xml', '--pdb',
    '--pdb-failures', '--pdb-errors', '--no-deprecated', '--with-doctest', '--doctest-tests',
    '--with-isolation', '-d', '--detailed-errors', '--failure-detail', '--no-skip',
    '--with-id', '--failed', '--process-restartworker', '--with-xunit',
    '--all-modules', '--collect-only', '--with-profile'];
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
    // tslint:disable-next-line:max-func-body-length
    filterArguments(args, argumentToRemoveOrFilter) {
        const optionsWithoutArgsToRemove = [];
        const optionsWithArgsToRemove = [];
        // Positional arguments in nosetest are test directories and files.
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
                    removePositionalArgs = true;
                    break;
                }
                case types_2.TestFilter.discovery: {
                    optionsWithoutArgsToRemove.push(...[
                        '-v', '--verbose', '-q', '--quiet',
                        '-x', '--stop',
                        '--with-coverage',
                        ...OptionsWithoutArguments.filter(item => item.startsWith('--cover')),
                        ...OptionsWithoutArguments.filter(item => item.startsWith('--logging')),
                        ...OptionsWithoutArguments.filter(item => item.startsWith('--pdb')),
                        ...OptionsWithoutArguments.filter(item => item.indexOf('xunit') >= 0)
                    ]);
                    optionsWithArgsToRemove.push(...[
                        '--verbosity', '-l', '--debug', '--cover-package',
                        ...OptionsWithoutArguments.filter(item => item.startsWith('--cover')),
                        ...OptionsWithArguments.filter(item => item.startsWith('--logging')),
                        ...OptionsWithoutArguments.filter(item => item.indexOf('xunit') >= 0)
                    ]);
                    break;
                }
                case types_2.TestFilter.debugAll:
                case types_2.TestFilter.runAll: {
                    break;
                }
                case types_2.TestFilter.debugSpecific:
                case types_2.TestFilter.runSpecific: {
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
        return this.helper.getPositionalArguments(args, OptionsWithArguments, OptionsWithoutArguments);
    }
};
ArgumentsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], ArgumentsService);
exports.ArgumentsService = ArgumentsService;
//# sourceMappingURL=argsService.js.map