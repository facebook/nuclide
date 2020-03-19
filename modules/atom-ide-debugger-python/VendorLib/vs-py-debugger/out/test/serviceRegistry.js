"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const TypeMoq = require("typemoq");
const constants_1 = require("../client/common/constants");
const logger_1 = require("../client/common/logger");
const constants_2 = require("../client/common/platform/constants");
const fileSystem_1 = require("../client/common/platform/fileSystem");
const pathUtils_1 = require("../client/common/platform/pathUtils");
const platformService_1 = require("../client/common/platform/platformService");
const serviceRegistry_1 = require("../client/common/platform/serviceRegistry");
const types_1 = require("../client/common/platform/types");
const decoder_1 = require("../client/common/process/decoder");
const proc_1 = require("../client/common/process/proc");
const pythonExecutionFactory_1 = require("../client/common/process/pythonExecutionFactory");
const pythonToolService_1 = require("../client/common/process/pythonToolService");
const serviceRegistry_2 = require("../client/common/process/serviceRegistry");
const types_2 = require("../client/common/process/types");
const serviceRegistry_3 = require("../client/common/serviceRegistry");
const types_3 = require("../client/common/types");
const serviceRegistry_4 = require("../client/common/variables/serviceRegistry");
const serviceRegistry_5 = require("../client/formatters/serviceRegistry");
const serviceRegistry_6 = require("../client/interpreter/serviceRegistry");
const container_1 = require("../client/ioc/container");
const serviceManager_1 = require("../client/ioc/serviceManager");
const types_4 = require("../client/ioc/types");
const serviceRegistry_7 = require("../client/linters/serviceRegistry");
const constants_3 = require("../client/unittests/common/constants");
const serviceRegistry_8 = require("../client/unittests/serviceRegistry");
const mockClasses_1 = require("./mockClasses");
const mementos_1 = require("./mocks/mementos");
const proc_2 = require("./mocks/proc");
const process_1 = require("./mocks/process");
class IocContainer {
    constructor() {
        this.disposables = [];
        const cont = new inversify_1.Container();
        this.serviceManager = new serviceManager_1.ServiceManager(cont);
        this.serviceContainer = new container_1.ServiceContainer(cont);
        this.serviceManager.addSingletonInstance(types_4.IServiceContainer, this.serviceContainer);
        this.serviceManager.addSingletonInstance(types_3.IDisposableRegistry, this.disposables);
        this.serviceManager.addSingleton(types_3.IMemento, mementos_1.MockMemento, types_3.GLOBAL_MEMENTO);
        this.serviceManager.addSingleton(types_3.IMemento, mementos_1.MockMemento, types_3.WORKSPACE_MEMENTO);
        const stdOutputChannel = new mockClasses_1.MockOutputChannel('Python');
        this.disposables.push(stdOutputChannel);
        this.serviceManager.addSingletonInstance(types_3.IOutputChannel, stdOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
        const testOutputChannel = new mockClasses_1.MockOutputChannel('Python Test - UnitTests');
        this.disposables.push(testOutputChannel);
        this.serviceManager.addSingletonInstance(types_3.IOutputChannel, testOutputChannel, constants_3.TEST_OUTPUT_CHANNEL);
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    registerCommonTypes(registerFileSystem = true) {
        serviceRegistry_3.registerTypes(this.serviceManager);
        if (registerFileSystem) {
            this.registerFileSystemTypes();
        }
    }
    registerFileSystemTypes() {
        this.serviceManager.addSingleton(types_1.IPlatformService, platformService_1.PlatformService);
        this.serviceManager.addSingleton(types_1.IFileSystem, fileSystem_1.FileSystem);
    }
    registerProcessTypes() {
        serviceRegistry_2.registerTypes(this.serviceManager);
    }
    registerVariableTypes() {
        serviceRegistry_4.registerTypes(this.serviceManager);
    }
    registerUnitTestTypes() {
        serviceRegistry_8.registerTypes(this.serviceManager);
    }
    registerLinterTypes() {
        serviceRegistry_7.registerTypes(this.serviceManager);
    }
    registerFormatterTypes() {
        serviceRegistry_5.registerTypes(this.serviceManager);
    }
    registerPlatformTypes() {
        serviceRegistry_1.registerTypes(this.serviceManager);
    }
    registerInterpreterTypes() {
        serviceRegistry_6.registerTypes(this.serviceManager);
    }
    registerMockProcessTypes() {
        this.serviceManager.addSingleton(types_2.IBufferDecoder, decoder_1.BufferDecoder);
        const processServiceFactory = TypeMoq.Mock.ofType();
        // tslint:disable-next-line:no-any
        const processService = new proc_2.MockProcessService(new proc_1.ProcessService(new decoder_1.BufferDecoder(), process.env));
        processServiceFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService));
        this.serviceManager.addSingletonInstance(types_2.IProcessServiceFactory, processServiceFactory.object);
        this.serviceManager.addSingleton(types_2.IPythonExecutionFactory, pythonExecutionFactory_1.PythonExecutionFactory);
        this.serviceManager.addSingleton(types_2.IPythonToolExecutionService, pythonToolService_1.PythonToolExecutionService);
    }
    registerMockProcess() {
        this.serviceManager.addSingletonInstance(types_3.IsWindows, constants_2.IS_WINDOWS);
        this.serviceManager.addSingletonInstance(types_3.Is64Bit, constants_2.IS_64_BIT);
        this.serviceManager.addSingleton(types_3.ILogger, logger_1.Logger);
        this.serviceManager.addSingleton(types_3.IPathUtils, pathUtils_1.PathUtils);
        this.serviceManager.addSingleton(types_3.ICurrentProcess, process_1.MockProcess);
    }
}
exports.IocContainer = IocContainer;
//# sourceMappingURL=serviceRegistry.js.map