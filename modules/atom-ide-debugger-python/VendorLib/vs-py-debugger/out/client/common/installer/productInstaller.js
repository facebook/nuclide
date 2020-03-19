"use strict";
// tslint:disable:max-classes-per-file max-classes-per-file
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
const os = require("os");
require("../../common/extensions");
const types_1 = require("../../ioc/types");
const types_2 = require("../../linters/types");
const types_3 = require("../application/types");
const constants_1 = require("../constants");
const types_4 = require("../platform/types");
const types_5 = require("../process/types");
const types_6 = require("../terminal/types");
const types_7 = require("../types");
const productNames_1 = require("./productNames");
const types_8 = require("./types");
var types_9 = require("../types");
exports.Product = types_9.Product;
const CTagsInsllationScript = os.platform() === 'darwin' ? 'brew install ctags' : 'sudo apt-get install exuberant-ctags';
class BaseInstaller {
    constructor(serviceContainer, outputChannel) {
        this.serviceContainer = serviceContainer;
        this.outputChannel = outputChannel;
        this.appShell = serviceContainer.get(types_3.IApplicationShell);
        this.configService = serviceContainer.get(types_7.IConfigurationService);
        this.workspaceService = serviceContainer.get(types_3.IWorkspaceService);
        this.productService = serviceContainer.get(types_8.IProductService);
    }
    promptToInstall(product, resource) {
        // If this method gets called twice, while previous promise has not been resolved, then return that same promise.
        // E.g. previous promise is not resolved as a message has been displayed to the user, so no point displaying
        // another message.
        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        const key = `${product}${workspaceFolder ? workspaceFolder.uri.fsPath : ''}`;
        if (BaseInstaller.PromptPromises.has(key)) {
            return BaseInstaller.PromptPromises.get(key);
        }
        const promise = this.promptToInstallImplementation(product, resource);
        BaseInstaller.PromptPromises.set(key, promise);
        promise.then(() => BaseInstaller.PromptPromises.delete(key)).ignoreErrors();
        promise.catch(() => BaseInstaller.PromptPromises.delete(key)).ignoreErrors();
        return promise;
    }
    install(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (product === types_7.Product.unittest) {
                return types_7.InstallerResponse.Installed;
            }
            const channels = this.serviceContainer.get(types_8.IInstallationChannelManager);
            const installer = yield channels.getInstallationChannel(product, resource);
            if (!installer) {
                return types_7.InstallerResponse.Ignore;
            }
            const moduleName = translateProductToModule(product, types_7.ModuleNamePurpose.install);
            const logger = this.serviceContainer.get(types_7.ILogger);
            yield installer.installModule(moduleName, resource)
                .catch(logger.logError.bind(logger, `Error in installing the module '${moduleName}'`));
            return this.isInstalled(product, resource)
                .then(isInstalled => isInstalled ? types_7.InstallerResponse.Installed : types_7.InstallerResponse.Ignore);
        });
    }
    isInstalled(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (product === types_7.Product.unittest) {
                return true;
            }
            // User may have customized the module name or provided the fully qualified path.
            const executableName = this.getExecutableNameFromSettings(product, resource);
            const isModule = this.isExecutableAModule(product, resource);
            if (isModule) {
                const pythonProcess = yield this.serviceContainer.get(types_5.IPythonExecutionFactory).create({ resource });
                return pythonProcess.isModuleInstalled(executableName);
            }
            else {
                const process = yield this.serviceContainer.get(types_5.IProcessServiceFactory).create(resource);
                return process.exec(executableName, ['--version'], { mergeStdOutErr: true })
                    .then(() => true)
                    .catch(() => false);
            }
        });
    }
    getExecutableNameFromSettings(product, resource) {
        const productType = this.productService.getProductType(product);
        const productPathService = this.serviceContainer.get(types_8.IProductPathService, productType);
        return productPathService.getExecutableNameFromSettings(product, resource);
    }
    isExecutableAModule(product, resource) {
        const productType = this.productService.getProductType(product);
        const productPathService = this.serviceContainer.get(types_8.IProductPathService, productType);
        return productPathService.isExecutableAModule(product, resource);
    }
}
BaseInstaller.PromptPromises = new Map();
exports.BaseInstaller = BaseInstaller;
class CTagsInstaller extends BaseInstaller {
    constructor(serviceContainer, outputChannel) {
        super(serviceContainer, outputChannel);
    }
    install(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.serviceContainer.get(types_4.IPlatformService).isWindows) {
                this.outputChannel.appendLine('Install Universal Ctags Win32 to enable support for Workspace Symbols');
                this.outputChannel.appendLine('Download the CTags binary from the Universal CTags site.');
                this.outputChannel.appendLine('Option 1: Extract ctags.exe from the downloaded zip to any folder within your PATH so that Visual Studio Code can run it.');
                this.outputChannel.appendLine('Option 2: Extract to any folder and add the path to this folder to the command setting.');
                this.outputChannel.appendLine('Option 3: Extract to any folder and define that path in the python.workspaceSymbols.ctagsPath setting of your user settings file (settings.json).');
                this.outputChannel.show();
            }
            else {
                const terminalService = this.serviceContainer.get(types_6.ITerminalServiceFactory).getTerminalService(resource);
                const logger = this.serviceContainer.get(types_7.ILogger);
                terminalService.sendCommand(CTagsInsllationScript, [])
                    .catch(logger.logError.bind(logger, `Failed to install ctags. Script sent '${CTagsInsllationScript}'.`));
            }
            return types_7.InstallerResponse.Ignore;
        });
    }
    promptToInstallImplementation(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const item = yield this.appShell.showErrorMessage('Install CTags to enable Python workspace symbols?', 'Yes', 'No');
            return item === 'Yes' ? this.install(product, resource) : types_7.InstallerResponse.Ignore;
        });
    }
}
exports.CTagsInstaller = CTagsInstaller;
class FormatterInstaller extends BaseInstaller {
    promptToInstallImplementation(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            // Hard-coded on purpose because the UI won't necessarily work having
            // another formatter.
            const formatters = [types_7.Product.autopep8, types_7.Product.black, types_7.Product.yapf];
            const formatterNames = formatters.map((formatter) => productNames_1.ProductNames.get(formatter));
            const productName = productNames_1.ProductNames.get(product);
            formatterNames.splice(formatterNames.indexOf(productName), 1);
            const useOptions = formatterNames.map((name) => `Use ${name}`);
            const yesChoice = 'Yes';
            const options = [...useOptions];
            let message = `Formatter ${productName} is not installed. Install?`;
            if (this.isExecutableAModule(product, resource)) {
                options.splice(0, 0, yesChoice);
            }
            else {
                const executable = this.getExecutableNameFromSettings(product, resource);
                message = `Path to the ${productName} formatter is invalid (${executable})`;
            }
            const item = yield this.appShell.showErrorMessage(message, ...options);
            if (item === yesChoice) {
                return this.install(product, resource);
            }
            else if (typeof item === 'string') {
                for (const formatter of formatters) {
                    const formatterName = productNames_1.ProductNames.get(formatter);
                    if (item.endsWith(formatterName)) {
                        yield this.configService.updateSetting('formatting.provider', formatterName, resource);
                        return this.install(formatter, resource);
                    }
                }
            }
            return types_7.InstallerResponse.Ignore;
        });
    }
}
exports.FormatterInstaller = FormatterInstaller;
class LinterInstaller extends BaseInstaller {
    promptToInstallImplementation(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const productName = productNames_1.ProductNames.get(product);
            const install = 'Install';
            const disableAllLinting = 'Disable linting';
            const disableThisLinter = `Disable ${productName}`;
            const options = [disableThisLinter, disableAllLinting];
            let message = `Linter ${productName} is not installed.`;
            if (this.isExecutableAModule(product, resource)) {
                options.splice(0, 0, install);
            }
            else {
                const executable = this.getExecutableNameFromSettings(product, resource);
                message = `Path to the ${productName} linter is invalid (${executable})`;
            }
            const response = yield this.appShell.showErrorMessage(message, ...options);
            if (response === install) {
                return this.install(product, resource);
            }
            const lm = this.serviceContainer.get(types_2.ILinterManager);
            if (response === disableAllLinting) {
                yield lm.enableLintingAsync(false);
                return types_7.InstallerResponse.Disabled;
            }
            else if (response === disableThisLinter) {
                yield lm.getLinterInfo(product).enableAsync(false);
                return types_7.InstallerResponse.Disabled;
            }
            return types_7.InstallerResponse.Ignore;
        });
    }
}
exports.LinterInstaller = LinterInstaller;
class TestFrameworkInstaller extends BaseInstaller {
    promptToInstallImplementation(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const productName = productNames_1.ProductNames.get(product);
            const options = [];
            let message = `Test framework ${productName} is not installed. Install?`;
            if (this.isExecutableAModule(product, resource)) {
                options.push(...['Yes', 'No']);
            }
            else {
                const executable = this.getExecutableNameFromSettings(product, resource);
                message = `Path to the ${productName} test framework is invalid (${executable})`;
            }
            const item = yield this.appShell.showErrorMessage(message, ...options);
            return item === 'Yes' ? this.install(product, resource) : types_7.InstallerResponse.Ignore;
        });
    }
}
exports.TestFrameworkInstaller = TestFrameworkInstaller;
class RefactoringLibraryInstaller extends BaseInstaller {
    promptToInstallImplementation(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const productName = productNames_1.ProductNames.get(product);
            const item = yield this.appShell.showErrorMessage(`Refactoring library ${productName} is not installed. Install?`, 'Yes', 'No');
            return item === 'Yes' ? this.install(product, resource) : types_7.InstallerResponse.Ignore;
        });
    }
}
exports.RefactoringLibraryInstaller = RefactoringLibraryInstaller;
let ProductInstaller = class ProductInstaller {
    constructor(serviceContainer, outputChannel) {
        this.serviceContainer = serviceContainer;
        this.outputChannel = outputChannel;
        this.productService = serviceContainer.get(types_8.IProductService);
    }
    // tslint:disable-next-line:no-empty
    dispose() { }
    promptToInstall(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.createInstaller(product).promptToInstall(product, resource);
        });
    }
    install(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.createInstaller(product).install(product, resource);
        });
    }
    isInstalled(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.createInstaller(product).isInstalled(product, resource);
        });
    }
    translateProductToModuleName(product, purpose) {
        return translateProductToModule(product, purpose);
    }
    createInstaller(product) {
        const productType = this.productService.getProductType(product);
        switch (productType) {
            case types_7.ProductType.Formatter:
                return new FormatterInstaller(this.serviceContainer, this.outputChannel);
            case types_7.ProductType.Linter:
                return new LinterInstaller(this.serviceContainer, this.outputChannel);
            case types_7.ProductType.WorkspaceSymbols:
                return new CTagsInstaller(this.serviceContainer, this.outputChannel);
            case types_7.ProductType.TestFramework:
                return new TestFrameworkInstaller(this.serviceContainer, this.outputChannel);
            case types_7.ProductType.RefactoringLibrary:
                return new RefactoringLibraryInstaller(this.serviceContainer, this.outputChannel);
            default:
                break;
        }
        throw new Error(`Unknown product ${product}`);
    }
};
ProductInstaller = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer)),
    __param(1, inversify_1.inject(types_7.IOutputChannel)), __param(1, inversify_1.named(constants_1.STANDARD_OUTPUT_CHANNEL))
], ProductInstaller);
exports.ProductInstaller = ProductInstaller;
function translateProductToModule(product, purpose) {
    switch (product) {
        case types_7.Product.mypy: return 'mypy';
        case types_7.Product.nosetest: {
            return purpose === types_7.ModuleNamePurpose.install ? 'nose' : 'nosetests';
        }
        case types_7.Product.pylama: return 'pylama';
        case types_7.Product.prospector: return 'prospector';
        case types_7.Product.pylint: return 'pylint';
        case types_7.Product.pytest: return 'pytest';
        case types_7.Product.autopep8: return 'autopep8';
        case types_7.Product.black: return 'black';
        case types_7.Product.pep8: return 'pep8';
        case types_7.Product.pydocstyle: return 'pydocstyle';
        case types_7.Product.yapf: return 'yapf';
        case types_7.Product.flake8: return 'flake8';
        case types_7.Product.unittest: return 'unittest';
        case types_7.Product.rope: return 'rope';
        case types_7.Product.bandit: return 'bandit';
        default: {
            throw new Error(`Product ${product} cannot be installed as a Python Module.`);
        }
    }
}
//# sourceMappingURL=productInstaller.js.map