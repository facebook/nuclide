"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const service_1 = require("../../client/common/configuration/service");
const channelManager_1 = require("../../client/common/installer/channelManager");
const productInstaller_1 = require("../../client/common/installer/productInstaller");
const productPath_1 = require("../../client/common/installer/productPath");
const productService_1 = require("../../client/common/installer/productService");
const types_2 = require("../../client/common/installer/types");
const logger_1 = require("../../client/common/logger");
const persistentState_1 = require("../../client/common/persistentState");
const pathUtils_1 = require("../../client/common/platform/pathUtils");
const currentProcess_1 = require("../../client/common/process/currentProcess");
const types_3 = require("../../client/common/process/types");
const types_4 = require("../../client/common/types");
const async_1 = require("../../client/common/utils/async");
const enum_1 = require("../../client/common/utils/enum");
const common_1 = require("../common");
const moduleInstaller_1 = require("../mocks/moduleInstaller");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const initialize_1 = require("./../initialize");
// tslint:disable-next-line:max-func-body-length
suite('Installer', () => {
    let ioc;
    const workspaceUri = vscode_1.Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
    const resource = initialize_1.IS_MULTI_ROOT_TEST ? workspaceUri : undefined;
    suiteSetup(initialize_1.initializeTest);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initializeTest();
        yield resetSettings();
        initializeDI();
    }));
    suiteTeardown(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.closeActiveWindows();
        yield resetSettings();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield initialize_1.closeActiveWindows();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerUnitTestTypes();
        ioc.registerFileSystemTypes();
        ioc.registerVariableTypes();
        ioc.registerLinterTypes();
        ioc.registerFormatterTypes();
        ioc.serviceManager.addSingleton(types_4.IPersistentStateFactory, persistentState_1.PersistentStateFactory);
        ioc.serviceManager.addSingleton(types_4.ILogger, logger_1.Logger);
        ioc.serviceManager.addSingleton(types_4.IInstaller, productInstaller_1.ProductInstaller);
        ioc.serviceManager.addSingleton(types_4.IPathUtils, pathUtils_1.PathUtils);
        ioc.serviceManager.addSingleton(types_4.ICurrentProcess, currentProcess_1.CurrentProcess);
        ioc.serviceManager.addSingleton(types_2.IInstallationChannelManager, channelManager_1.InstallationChannelManager);
        ioc.serviceManager.addSingletonInstance(types_1.ICommandManager, TypeMoq.Mock.ofType().object);
        ioc.serviceManager.addSingletonInstance(types_1.IApplicationShell, TypeMoq.Mock.ofType().object);
        ioc.serviceManager.addSingleton(types_4.IConfigurationService, service_1.ConfigurationService);
        const workspaceService = TypeMoq.Mock.ofType();
        workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);
        ioc.serviceManager.addSingletonInstance(types_1.IWorkspaceService, workspaceService.object);
        ioc.registerMockProcessTypes();
        ioc.serviceManager.addSingletonInstance(types_4.IsWindows, false);
        ioc.serviceManager.addSingletonInstance(types_2.IProductService, new productService_1.ProductService());
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.CTagsProductPathService, types_4.ProductType.WorkspaceSymbols);
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.FormatterProductPathService, types_4.ProductType.Formatter);
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.LinterProductPathService, types_4.ProductType.Linter);
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.TestFrameworkProductPathService, types_4.ProductType.TestFramework);
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.RefactoringLibraryProductPathService, types_4.ProductType.RefactoringLibrary);
    }
    function resetSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield common_1.updateSetting('linting.pylintEnabled', true, common_1.rootWorkspaceUri, vscode_1.ConfigurationTarget.Workspace);
        });
    }
    function testCheckingIfProductIsInstalled(product) {
        return __awaiter(this, void 0, void 0, function* () {
            const installer = ioc.serviceContainer.get(types_4.IInstaller);
            const processService = yield ioc.serviceContainer.get(types_3.IProcessServiceFactory).create();
            const checkInstalledDef = async_1.createDeferred();
            processService.onExec((file, args, options, callback) => {
                const moduleName = installer.translateProductToModuleName(product, types_4.ModuleNamePurpose.run);
                if (args.length > 1 && args[0] === '-c' && args[1] === `import ${moduleName}`) {
                    checkInstalledDef.resolve(true);
                }
                callback({ stdout: '' });
            });
            yield installer.isInstalled(product, resource);
            yield checkInstalledDef.promise;
        });
    }
    enum_1.getNamesAndValues(types_4.Product).forEach(prod => {
        test(`Ensure isInstalled for Product: '${prod.name}' executes the right command`, () => __awaiter(this, void 0, void 0, function* () {
            ioc.serviceManager.addSingletonInstance(types_2.IModuleInstaller, new moduleInstaller_1.MockModuleInstaller('one', false));
            ioc.serviceManager.addSingletonInstance(types_2.IModuleInstaller, new moduleInstaller_1.MockModuleInstaller('two', true));
            if (prod.value === types_4.Product.ctags || prod.value === types_4.Product.unittest || prod.value === types_4.Product.isort) {
                return;
            }
            yield testCheckingIfProductIsInstalled(prod.value);
        }));
    });
    function testInstallingProduct(product) {
        return __awaiter(this, void 0, void 0, function* () {
            const installer = ioc.serviceContainer.get(types_4.IInstaller);
            const checkInstalledDef = async_1.createDeferred();
            const moduleInstallers = ioc.serviceContainer.getAll(types_2.IModuleInstaller);
            const moduleInstallerOne = moduleInstallers.find(item => item.displayName === 'two');
            moduleInstallerOne.on('installModule', moduleName => {
                const installName = installer.translateProductToModuleName(product, types_4.ModuleNamePurpose.install);
                if (installName === moduleName) {
                    checkInstalledDef.resolve();
                }
            });
            yield installer.install(product);
            yield checkInstalledDef.promise;
        });
    }
    enum_1.getNamesAndValues(types_4.Product).forEach(prod => {
        test(`Ensure install for Product: '${prod.name}' executes the right command in IModuleInstaller`, () => __awaiter(this, void 0, void 0, function* () {
            ioc.serviceManager.addSingletonInstance(types_2.IModuleInstaller, new moduleInstaller_1.MockModuleInstaller('one', false));
            ioc.serviceManager.addSingletonInstance(types_2.IModuleInstaller, new moduleInstaller_1.MockModuleInstaller('two', true));
            if (prod.value === types_4.Product.unittest || prod.value === types_4.Product.ctags || prod.value === types_4.Product.isort) {
                return;
            }
            yield testInstallingProduct(prod.value);
        }));
    });
});
//# sourceMappingURL=installer.test.js.map