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
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
const telemetry_1 = require("../telemetry");
const constants_2 = require("../telemetry/constants");
const types_2 = require("../terminals/types");
class ReplProvider {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.disposables = [];
        this.registerCommand();
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    registerCommand() {
        const commandManager = this.serviceContainer.get(types_1.ICommandManager);
        const disposable = commandManager.registerCommand(constants_1.Commands.Start_REPL, this.commandHandler, this);
        this.disposables.push(disposable);
    }
    commandHandler() {
        return __awaiter(this, void 0, void 0, function* () {
            const resource = this.getActiveResourceUri();
            const replProvider = this.serviceContainer.get(types_2.ICodeExecutionService, 'repl');
            yield replProvider.initializeRepl(resource);
        });
    }
    getActiveResourceUri() {
        const documentManager = this.serviceContainer.get(types_1.IDocumentManager);
        if (documentManager.activeTextEditor && !documentManager.activeTextEditor.document.isUntitled) {
            return documentManager.activeTextEditor.document.uri;
        }
        const workspace = this.serviceContainer.get(types_1.IWorkspaceService);
        if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            return workspace.workspaceFolders[0].uri;
        }
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_2.REPL)
], ReplProvider.prototype, "commandHandler", null);
exports.ReplProvider = ReplProvider;
//# sourceMappingURL=replProvider.js.map