"use strict";
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
const fs = require("fs");
const path = require("path");
const vscode_1 = require("vscode");
const configSettings_1 = require("../common/configSettings");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
class Generator {
    constructor(workspaceFolder, output, processServiceFactory) {
        this.workspaceFolder = workspaceFolder;
        this.output = output;
        this.processServiceFactory = processServiceFactory;
        this.disposables = [];
        this.optionsFile = path.join(__dirname, '..', '..', '..', 'resources', 'ctagOptions');
        this.pythonSettings = configSettings_1.PythonSettings.getInstance(workspaceFolder);
    }
    get tagFilePath() {
        return this.pythonSettings.workspaceSymbols.tagFilePath;
    }
    get enabled() {
        return this.pythonSettings.workspaceSymbols.enabled;
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    generateWorkspaceTags() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.pythonSettings.workspaceSymbols.enabled) {
                return;
            }
            return this.generateTags({ directory: this.workspaceFolder.fsPath });
        });
    }
    buildCmdArgs() {
        const exclusions = this.pythonSettings.workspaceSymbols.exclusionPatterns;
        const excludes = exclusions.length === 0 ? [] : exclusions.map(pattern => `--exclude=${pattern}`);
        return [`--options=${this.optionsFile}`, '--languages=Python'].concat(excludes);
    }
    generateTags(source) {
        const tagFile = path.normalize(this.pythonSettings.workspaceSymbols.tagFilePath);
        const cmd = this.pythonSettings.workspaceSymbols.ctagsPath;
        const args = this.buildCmdArgs();
        let outputFile = tagFile;
        if (source.file && source.file.length > 0) {
            source.directory = path.dirname(source.file);
        }
        if (path.dirname(outputFile) === source.directory) {
            outputFile = path.basename(outputFile);
        }
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        args.push('-o', outputFile, '.');
        this.output.appendLine(`${'-'.repeat(10)}Generating Tags${'-'.repeat(10)}`);
        this.output.appendLine(`${cmd} ${args.join(' ')}`);
        const promise = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const processService = yield this.processServiceFactory.create();
            const result = processService.execObservable(cmd, args, { cwd: source.directory });
            let errorMsg = '';
            result.out.subscribe(output => {
                if (output.source === 'stderr') {
                    errorMsg += output.out;
                }
                this.output.append(output.out);
            }, reject, () => {
                if (errorMsg.length > 0) {
                    reject(new Error(errorMsg));
                }
                else {
                    resolve();
                }
            });
        }));
        vscode_1.window.setStatusBarMessage('Generating Tags', promise);
        return promise;
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_1.WORKSPACE_SYMBOLS_BUILD)
], Generator.prototype, "generateTags", null);
exports.Generator = Generator;
//# sourceMappingURL=generator.js.map