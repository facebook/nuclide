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
const OptionsWithArguments = ['-k', '-p', '-s', '-t', '--pattern',
    '--start-directory', '--top-level-directory'];
const OptionsWithoutArguments = ['-b', '-c', '-f', '-h', '-q', '-v',
    '--buffer', '--catch', '--failfast', '--help', '--locals',
    '--quiet', '--verbose'];
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
        // Positional arguments in pytest positional args are test directories and files.
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
            removePositionalArgs = true;
        }
        let filteredArgs = args.slice();
        if (removePositionalArgs) {
            const positionalArgs = this.helper.getPositionalArguments(filteredArgs, OptionsWithArguments, OptionsWithoutArguments);
            filteredArgs = filteredArgs.filter(item => positionalArgs.indexOf(item) === -1);
        }
        return this.helper.filterArguments(filteredArgs, optionsWithArgsToRemove, optionsWithoutArgsToRemove);
    }
    getTestFolders(args) {
        const shortValue = this.helper.getOptionValues(args, '-s');
        if (typeof shortValue === 'string') {
            return [shortValue];
        }
        const longValue = this.helper.getOptionValues(args, '--start-directory');
        if (typeof longValue === 'string') {
            return [longValue];
        }
        return ['.'];
    }
};
ArgumentsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], ArgumentsService);
exports.ArgumentsService = ArgumentsService;
//# sourceMappingURL=argsService.js.map