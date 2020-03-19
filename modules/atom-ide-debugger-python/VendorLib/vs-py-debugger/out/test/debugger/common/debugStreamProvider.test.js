"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const getFreePort = require("get-port");
const net = require("net");
const TypeMoq = require("typemoq");
const types_1 = require("../../../client/common/types");
const debugStreamProvider_1 = require("../../../client/debugger/debugAdapter/Common/debugStreamProvider");
const common_1 = require("../../common");
// tslint:disable-next-line:max-func-body-length
suite('Debugging - Stream Provider', () => {
    let streamProvider;
    let serviceContainer;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        streamProvider = new debugStreamProvider_1.DebugStreamProvider(serviceContainer.object);
    });
    test('Process is returned as is if there is no port number if args', () => __awaiter(this, void 0, void 0, function* () {
        const mockProcess = { argv: [], env: [], stdin: '1234', stdout: '5678' };
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.ICurrentProcess))).returns(() => mockProcess);
        const streams = yield streamProvider.getInputAndOutputStreams();
        chai_1.expect(streams.input).to.be.equal(mockProcess.stdin);
        chai_1.expect(streams.output).to.be.equal(mockProcess.stdout);
    }));
    test('Starts a socketserver on the port provided and returns the client socket', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield getFreePort({ host: 'localhost', port: 3000 });
        const mockProcess = { argv: ['node', 'index.js', `--server=${port}`], env: [], stdin: '1234', stdout: '5678' };
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.ICurrentProcess))).returns(() => mockProcess);
        const streamsPromise = streamProvider.getInputAndOutputStreams();
        yield common_1.sleep(1);
        yield new Promise(resolve => {
            net.connect({ port, host: 'localhost' }, resolve);
        });
        const streams = yield streamsPromise;
        chai_1.expect(streams.input).to.not.be.equal(mockProcess.stdin);
        chai_1.expect(streams.output).to.not.be.equal(mockProcess.stdout);
    }));
    test('Ensure existence of port is identified', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield getFreePort({ host: 'localhost', port: 3000 });
        const mockProcess = { argv: ['node', 'index.js', `--server=${port}`], env: [], stdin: '1234', stdout: '5678' };
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.ICurrentProcess))).returns(() => mockProcess);
        chai_1.expect(streamProvider.useDebugSocketStream).to.be.equal(true, 'incorrect');
    }));
    test('Ensure non-existence of port is identified', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield getFreePort({ host: 'localhost', port: 3000 });
        const mockProcess = { argv: ['node', 'index.js', `--other=${port}`], env: [], stdin: '1234', stdout: '5678' };
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.ICurrentProcess))).returns(() => mockProcess);
        chai_1.expect(streamProvider.useDebugSocketStream).to.not.be.equal(true, 'incorrect');
    }));
});
//# sourceMappingURL=debugStreamProvider.test.js.map