'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
const _ = require("lodash");
const vscode_1 = require("vscode");
const constants_1 = require("../common/constants");
const telemetry_1 = require("../telemetry");
const constants_2 = require("../telemetry/constants");
const parser_1 = require("./parser");
class WorkspaceSymbolProvider {
    constructor(fs, commands, tagGenerators) {
        this.fs = fs;
        this.commands = commands;
        this.tagGenerators = tagGenerators;
    }
    provideWorkspaceSymbols(query, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.tagGenerators.length === 0) {
                return [];
            }
            const generatorsWithTagFiles = yield Promise.all(this.tagGenerators.map(generator => this.fs.fileExists(generator.tagFilePath)));
            if (generatorsWithTagFiles.filter(exists => exists).length !== this.tagGenerators.length) {
                yield this.commands.executeCommand(constants_1.Commands.Build_Workspace_Symbols, true, token);
            }
            const generators = yield Promise.all(this.tagGenerators.map((generator) => __awaiter(this, void 0, void 0, function* () {
                const tagFileExists = yield this.fs.fileExists(generator.tagFilePath);
                return tagFileExists ? generator : undefined;
            })));
            const promises = generators
                .filter(generator => generator !== undefined && generator.enabled)
                .map((generator) => __awaiter(this, void 0, void 0, function* () {
                // load tags
                const items = yield parser_1.parseTags(generator.workspaceFolder.fsPath, generator.tagFilePath, query, token);
                if (!Array.isArray(items)) {
                    return [];
                }
                return items.map(item => new vscode_1.SymbolInformation(item.symbolName, item.symbolKind, '', new vscode_1.Location(vscode_1.Uri.file(item.fileName), item.position)));
            }));
            const symbols = yield Promise.all(promises);
            return _.flatten(symbols);
        });
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_2.WORKSPACE_SYMBOLS_GO_TO)
], WorkspaceSymbolProvider.prototype, "provideWorkspaceSymbols", null);
exports.WorkspaceSymbolProvider = WorkspaceSymbolProvider;
//# sourceMappingURL=provider.js.map