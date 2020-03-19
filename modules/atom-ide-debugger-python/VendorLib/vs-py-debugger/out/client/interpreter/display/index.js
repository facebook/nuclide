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
const types_1 = require("../../common/application/types");
const types_2 = require("../../common/types");
const types_3 = require("../../ioc/types");
const contracts_1 = require("../contracts");
// tslint:disable-next-line:completed-docs
let InterpreterDisplay = class InterpreterDisplay {
    constructor(serviceContainer) {
        this.helper = serviceContainer.get(contracts_1.IInterpreterHelper);
        this.workspaceService = serviceContainer.get(types_1.IWorkspaceService);
        this.pathUtils = serviceContainer.get(types_2.IPathUtils);
        this.interpreterService = serviceContainer.get(contracts_1.IInterpreterService);
        const application = serviceContainer.get(types_1.IApplicationShell);
        const disposableRegistry = serviceContainer.get(types_2.IDisposableRegistry);
        this.statusBar = application.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 100);
        this.statusBar.command = 'python.setInterpreter';
        disposableRegistry.push(this.statusBar);
    }
    refresh(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            // Use the workspace Uri if available
            if (resource && this.workspaceService.getWorkspaceFolder(resource)) {
                resource = this.workspaceService.getWorkspaceFolder(resource).uri;
            }
            if (!resource) {
                const wkspc = this.helper.getActiveWorkspaceUri();
                resource = wkspc ? wkspc.folderUri : undefined;
            }
            yield this.updateDisplay(resource);
        });
    }
    updateDisplay(workspaceFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpreter = yield this.interpreterService.getActiveInterpreter(workspaceFolder);
            if (interpreter) {
                this.statusBar.color = '';
                this.statusBar.tooltip = this.pathUtils.getDisplayName(interpreter.path, workspaceFolder ? workspaceFolder.fsPath : undefined);
                this.statusBar.text = interpreter.displayName;
            }
            else {
                this.statusBar.tooltip = '';
                this.statusBar.color = 'yellow';
                this.statusBar.text = '$(alert) Select Python Interpreter';
            }
            this.statusBar.show();
        });
    }
};
InterpreterDisplay = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], InterpreterDisplay);
exports.InterpreterDisplay = InterpreterDisplay;
//# sourceMappingURL=index.js.map