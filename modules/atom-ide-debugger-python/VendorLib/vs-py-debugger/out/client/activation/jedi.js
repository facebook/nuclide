"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const constants_1 = require("../common/constants");
const types_1 = require("../common/types");
const contracts_1 = require("../interpreter/contracts");
const types_2 = require("../ioc/types");
const jediProxyFactory_1 = require("../languageServices/jediProxyFactory");
const completionProvider_1 = require("../providers/completionProvider");
const definitionProvider_1 = require("../providers/definitionProvider");
const hoverProvider_1 = require("../providers/hoverProvider");
const objectDefinitionProvider_1 = require("../providers/objectDefinitionProvider");
const referenceProvider_1 = require("../providers/referenceProvider");
const renameProvider_1 = require("../providers/renameProvider");
const signatureProvider_1 = require("../providers/signatureProvider");
const symbolProvider_1 = require("../providers/symbolProvider");
const blockFormatProvider_1 = require("../typeFormatters/blockFormatProvider");
const dispatcher_1 = require("../typeFormatters/dispatcher");
const onEnterFormatter_1 = require("../typeFormatters/onEnterFormatter");
const types_3 = require("../unittests/types");
const main_1 = require("../workspaceSymbols/main");
let JediExtensionActivator = class JediExtensionActivator {
    constructor(serviceManager) {
        this.serviceManager = serviceManager;
        this.context = this.serviceManager.get(types_1.IExtensionContext);
        this.documentSelector = constants_1.PYTHON;
    }
    activate() {
        return __awaiter(this, void 0, void 0, function* () {
            const context = this.context;
            const jediFactory = this.jediFactory = new jediProxyFactory_1.JediFactory(context.asAbsolutePath('.'), this.serviceManager);
            context.subscriptions.push(jediFactory);
            context.subscriptions.push(...objectDefinitionProvider_1.activateGoToObjectDefinitionProvider(jediFactory));
            context.subscriptions.push(jediFactory);
            context.subscriptions.push(vscode_1.languages.registerRenameProvider(this.documentSelector, new renameProvider_1.PythonRenameProvider(this.serviceManager)));
            const definitionProvider = new definitionProvider_1.PythonDefinitionProvider(jediFactory);
            context.subscriptions.push(vscode_1.languages.registerDefinitionProvider(this.documentSelector, definitionProvider));
            context.subscriptions.push(vscode_1.languages.registerHoverProvider(this.documentSelector, new hoverProvider_1.PythonHoverProvider(jediFactory)));
            context.subscriptions.push(vscode_1.languages.registerReferenceProvider(this.documentSelector, new referenceProvider_1.PythonReferenceProvider(jediFactory)));
            context.subscriptions.push(vscode_1.languages.registerCompletionItemProvider(this.documentSelector, new completionProvider_1.PythonCompletionItemProvider(jediFactory, this.serviceManager), '.'));
            context.subscriptions.push(vscode_1.languages.registerCodeLensProvider(this.documentSelector, this.serviceManager.get(contracts_1.IShebangCodeLensProvider)));
            const onTypeDispatcher = new dispatcher_1.OnTypeFormattingDispatcher({
                '\n': new onEnterFormatter_1.OnEnterFormatter(),
                ':': new blockFormatProvider_1.BlockFormatProviders()
            });
            const onTypeTriggers = onTypeDispatcher.getTriggerCharacters();
            if (onTypeTriggers) {
                context.subscriptions.push(vscode_1.languages.registerOnTypeFormattingEditProvider(constants_1.PYTHON, onTypeDispatcher, onTypeTriggers.first, ...onTypeTriggers.more));
            }
            const serviceContainer = this.serviceManager.get(types_2.IServiceContainer);
            context.subscriptions.push(new main_1.WorkspaceSymbols(serviceContainer));
            const symbolProvider = new symbolProvider_1.JediSymbolProvider(serviceContainer, jediFactory);
            context.subscriptions.push(vscode_1.languages.registerDocumentSymbolProvider(this.documentSelector, symbolProvider));
            const pythonSettings = this.serviceManager.get(types_1.IConfigurationService).getSettings();
            if (pythonSettings.devOptions.indexOf('DISABLE_SIGNATURE') === -1) {
                context.subscriptions.push(vscode_1.languages.registerSignatureHelpProvider(this.documentSelector, new signatureProvider_1.PythonSignatureProvider(jediFactory), '(', ','));
            }
            context.subscriptions.push(vscode_1.languages.registerRenameProvider(constants_1.PYTHON, new renameProvider_1.PythonRenameProvider(serviceContainer)));
            const testManagementService = this.serviceManager.get(types_3.IUnitTestManagementService);
            testManagementService.activate()
                .then(() => testManagementService.activateCodeLenses(symbolProvider))
                .catch(ex => this.serviceManager.get(types_1.ILogger).logError('Failed to activate Unit Tests', ex));
            return true;
        });
    }
    deactivate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.jediFactory) {
                this.jediFactory.dispose();
            }
        });
    }
};
JediExtensionActivator = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceManager))
], JediExtensionActivator);
exports.JediExtensionActivator = JediExtensionActivator;
//# sourceMappingURL=jedi.js.map