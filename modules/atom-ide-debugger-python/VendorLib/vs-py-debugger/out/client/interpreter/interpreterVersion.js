"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
require("../common/extensions");
const types_1 = require("../common/process/types");
exports.PIP_VERSION_REGEX = '\\d+\\.\\d+(\\.\\d+)?';
let InterpreterVersionService = class InterpreterVersionService {
    constructor(processServiceFactory) {
        this.processServiceFactory = processServiceFactory;
    }
    getVersion(pythonPath, defaultValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const processService = yield this.processServiceFactory.create();
            return processService.exec(pythonPath, ['--version'], { mergeStdOutErr: true })
                .then(output => output.stdout.splitLines()[0])
                .then(version => version.length === 0 ? defaultValue : version)
                .catch(() => defaultValue);
        });
    }
    getPipVersion(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const processService = yield this.processServiceFactory.create();
            const output = yield processService.exec(pythonPath, ['-m', 'pip', '--version'], { mergeStdOutErr: true });
            if (output.stdout.length > 0) {
                // Here's a sample output:
                // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
                const re = new RegExp(exports.PIP_VERSION_REGEX, 'g');
                const matches = re.exec(output.stdout);
                if (matches && matches.length > 0) {
                    return matches[0].trim();
                }
            }
            throw new Error(`Unable to determine pip version from output '${output.stdout}'`);
        });
    }
};
InterpreterVersionService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IProcessServiceFactory))
], InterpreterVersionService);
exports.InterpreterVersionService = InterpreterVersionService;
//# sourceMappingURL=interpreterVersion.js.map