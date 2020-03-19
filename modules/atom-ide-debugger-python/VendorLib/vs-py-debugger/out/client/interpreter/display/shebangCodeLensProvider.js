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
const vscode_1 = require("vscode");
const settings = require("../../common/configSettings");
const types_1 = require("../../common/process/types");
const util_1 = require("../../common/util");
const types_2 = require("../../ioc/types");
let ShebangCodeLensProvider = class ShebangCodeLensProvider {
    constructor(serviceContainer) {
        // tslint:disable-next-line:no-any
        this.onDidChangeCodeLenses = vscode_1.workspace.onDidChangeConfiguration;
        this.processServiceFactory = serviceContainer.get(types_1.IProcessServiceFactory);
    }
    detectShebang(document) {
        return __awaiter(this, void 0, void 0, function* () {
            const firstLine = document.lineAt(0);
            if (firstLine.isEmptyOrWhitespace) {
                return;
            }
            if (!firstLine.text.startsWith('#!')) {
                return;
            }
            const shebang = firstLine.text.substr(2).trim();
            const pythonPath = yield this.getFullyQualifiedPathToInterpreter(shebang, document.uri);
            return typeof pythonPath === 'string' && pythonPath.length > 0 ? pythonPath : undefined;
        });
    }
    provideCodeLenses(document, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const codeLenses = yield this.createShebangCodeLens(document);
            return Promise.resolve(codeLenses);
        });
    }
    getFullyQualifiedPathToInterpreter(pythonPath, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            let cmdFile = pythonPath;
            let args = ['-c', 'import sys;print(sys.executable)'];
            if (pythonPath.indexOf('bin/env ') >= 0 && !util_1.IS_WINDOWS) {
                // In case we have pythonPath as '/usr/bin/env python'.
                const parts = pythonPath.split(' ').map(part => part.trim()).filter(part => part.length > 0);
                cmdFile = parts.shift();
                args = parts.concat(args);
            }
            const processService = yield this.processServiceFactory.create(resource);
            return processService.exec(cmdFile, args)
                .then(output => output.stdout.trim())
                .catch(() => '');
        });
    }
    createShebangCodeLens(document) {
        return __awaiter(this, void 0, void 0, function* () {
            const shebang = yield this.detectShebang(document);
            const pythonPath = settings.PythonSettings.getInstance(document.uri).pythonPath;
            const resolvedPythonPath = yield this.getFullyQualifiedPathToInterpreter(pythonPath, document.uri);
            if (!shebang || shebang === resolvedPythonPath) {
                return [];
            }
            const firstLine = document.lineAt(0);
            const startOfShebang = new vscode_1.Position(0, 0);
            const endOfShebang = new vscode_1.Position(0, firstLine.text.length - 1);
            const shebangRange = new vscode_1.Range(startOfShebang, endOfShebang);
            const cmd = {
                command: 'python.setShebangInterpreter',
                title: 'Set as interpreter'
            };
            return [(new vscode_1.CodeLens(shebangRange, cmd))];
        });
    }
};
ShebangCodeLensProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], ShebangCodeLensProvider);
exports.ShebangCodeLensProvider = ShebangCodeLensProvider;
//# sourceMappingURL=shebangCodeLensProvider.js.map