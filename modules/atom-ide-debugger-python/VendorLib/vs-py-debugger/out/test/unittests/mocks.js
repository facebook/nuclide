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
const events_1 = require("events");
const inversify_1 = require("inversify");
const async_1 = require("../../client/common/utils/async");
const constants_1 = require("../../client/unittests/common/constants");
const baseTestManager_1 = require("../../client/unittests/common/managers/baseTestManager");
let MockDebugLauncher = class MockDebugLauncher {
    constructor() {
        this._launched = async_1.createDeferred();
    }
    get launched() {
        return this._launched.promise;
    }
    get debuggerPromise() {
        // tslint:disable-next-line:no-non-null-assertion
        return this._promise;
    }
    get cancellationToken() {
        if (this._token === undefined) {
            throw Error('debugger not launched');
        }
        return this._token;
    }
    getLaunchOptions(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return { port: 0, host: 'localhost' };
        });
    }
    launchDebugger(options) {
        return __awaiter(this, void 0, void 0, function* () {
            this._launched.resolve(true);
            // tslint:disable-next-line:no-non-null-assertion
            this._token = options.token;
            this._promise = async_1.createDeferred();
            // tslint:disable-next-line:no-non-null-assertion
            options.token.onCancellationRequested(() => {
                if (this._promise) {
                    this._promise.reject('Mock-User Cancelled');
                }
            });
            return this._promise.promise;
        });
    }
    dispose() {
        this._promise = undefined;
    }
};
MockDebugLauncher = __decorate([
    inversify_1.injectable()
], MockDebugLauncher);
exports.MockDebugLauncher = MockDebugLauncher;
let MockTestManagerWithRunningTests = class MockTestManagerWithRunningTests extends baseTestManager_1.BaseTestManager {
    constructor(testProvider, product, workspaceFolder, rootDirectory, serviceContainer) {
        super(testProvider, product, workspaceFolder, rootDirectory, serviceContainer);
        // tslint:disable-next-line:no-any
        this.runnerDeferred = async_1.createDeferred();
        this.enabled = true;
        // tslint:disable-next-line:no-any
        this.discoveryDeferred = async_1.createDeferred();
    }
    getDiscoveryOptions(ignoreCache) {
        // tslint:disable-next-line:no-object-literal-type-assertion
        return {};
    }
    // tslint:disable-next-line:no-any
    runTestImpl(tests, testsToRun, runFailedTests, debug) {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-non-null-assertion
            this.testRunnerCancellationToken.onCancellationRequested(() => {
                this.runnerDeferred.reject(constants_1.CANCELLATION_REASON);
            });
            return this.runnerDeferred.promise;
        });
    }
    discoverTestsImpl(ignoreCache, debug) {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-non-null-assertion
            this.testDiscoveryCancellationToken.onCancellationRequested(() => {
                this.discoveryDeferred.reject(constants_1.CANCELLATION_REASON);
            });
            return this.discoveryDeferred.promise;
        });
    }
};
MockTestManagerWithRunningTests = __decorate([
    inversify_1.injectable()
], MockTestManagerWithRunningTests);
exports.MockTestManagerWithRunningTests = MockTestManagerWithRunningTests;
let MockDiscoveryService = class MockDiscoveryService {
    constructor(discoverPromise) {
        this.discoverPromise = discoverPromise;
    }
    discoverTests(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.discoverPromise;
        });
    }
};
MockDiscoveryService = __decorate([
    inversify_1.injectable()
], MockDiscoveryService);
exports.MockDiscoveryService = MockDiscoveryService;
// tslint:disable-next-line:max-classes-per-file
let MockUnitTestSocketServer = class MockUnitTestSocketServer extends events_1.EventEmitter {
    // tslint:disable-next-line:max-classes-per-file
    constructor() {
        super(...arguments);
        this.results = [];
    }
    reset() {
        this.removeAllListeners();
    }
    addResults(results) {
        this.results.push(...results);
    }
    start(options = { port: 0, host: 'localhost' }) {
        return __awaiter(this, void 0, void 0, function* () {
            this.results.forEach(result => {
                this.emit('result', result);
            });
            this.results = [];
            return typeof options.port === 'number' ? options.port : 0;
        });
    }
    // tslint:disable-next-line:no-empty
    stop() { }
    // tslint:disable-next-line:no-empty
    dispose() { }
};
MockUnitTestSocketServer = __decorate([
    inversify_1.injectable()
], MockUnitTestSocketServer);
exports.MockUnitTestSocketServer = MockUnitTestSocketServer;
//# sourceMappingURL=mocks.js.map