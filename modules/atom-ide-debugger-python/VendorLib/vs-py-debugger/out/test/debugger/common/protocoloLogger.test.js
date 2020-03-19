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
const stream_1 = require("stream");
const TypeMoq = require("typemoq");
const protocolLogger_1 = require("../../../client/debugger/debugAdapter/Common/protocolLogger");
// tslint:disable-next-line:max-func-body-length
suite('Debugging - Protocol Logger', () => {
    let protocolLogger;
    setup(() => {
        protocolLogger = new protocolLogger_1.ProtocolLogger();
    });
    test('Ensure messages are buffered untill logger is provided', () => __awaiter(this, void 0, void 0, function* () {
        const inputStream = new stream_1.PassThrough();
        const outputStream = new stream_1.PassThrough();
        protocolLogger.connect(inputStream, outputStream);
        inputStream.write('A');
        outputStream.write('1');
        inputStream.write('B');
        inputStream.write('C');
        outputStream.write('2');
        outputStream.write('3');
        const logger = TypeMoq.Mock.ofType();
        protocolLogger.setup(logger.object);
        logger.verify(l => l.verbose('From Client:'), TypeMoq.Times.exactly(3));
        logger.verify(l => l.verbose('To Client:'), TypeMoq.Times.exactly(3));
        const expectedLogFileContents = ['A', '1', 'B', 'C', '2', '3'];
        for (const expectedContent of expectedLogFileContents) {
            logger.verify(l => l.verbose(expectedContent), TypeMoq.Times.once());
        }
    }));
    test('Ensure messages are are logged as they arrive', () => __awaiter(this, void 0, void 0, function* () {
        const inputStream = new stream_1.PassThrough();
        const outputStream = new stream_1.PassThrough();
        protocolLogger.connect(inputStream, outputStream);
        inputStream.write('A');
        outputStream.write('1');
        const logger = TypeMoq.Mock.ofType();
        protocolLogger.setup(logger.object);
        inputStream.write('B');
        inputStream.write('C');
        outputStream.write('2');
        outputStream.write('3');
        logger.verify(l => l.verbose('From Client:'), TypeMoq.Times.exactly(3));
        logger.verify(l => l.verbose('To Client:'), TypeMoq.Times.exactly(3));
        const expectedLogFileContents = ['A', '1', 'B', 'C', '2', '3'];
        for (const expectedContent of expectedLogFileContents) {
            logger.verify(l => l.verbose(expectedContent), TypeMoq.Times.once());
        }
    }));
    test('Ensure nothing is logged once logging is disabled', () => __awaiter(this, void 0, void 0, function* () {
        const inputStream = new stream_1.PassThrough();
        const outputStream = new stream_1.PassThrough();
        protocolLogger.connect(inputStream, outputStream);
        const logger = TypeMoq.Mock.ofType();
        protocolLogger.setup(logger.object);
        inputStream.write('A');
        outputStream.write('1');
        protocolLogger.dispose();
        inputStream.write('B');
        inputStream.write('C');
        outputStream.write('2');
        outputStream.write('3');
        logger.verify(l => l.verbose('From Client:'), TypeMoq.Times.exactly(1));
        logger.verify(l => l.verbose('To Client:'), TypeMoq.Times.exactly(1));
        const expectedLogFileContents = ['A', '1'];
        const notExpectedLogFileContents = ['B', 'C', '2', '3'];
        for (const expectedContent of expectedLogFileContents) {
            logger.verify(l => l.verbose(expectedContent), TypeMoq.Times.once());
        }
        for (const notExpectedContent of notExpectedLogFileContents) {
            logger.verify(l => l.verbose(notExpectedContent), TypeMoq.Times.never());
        }
    }));
});
//# sourceMappingURL=protocoloLogger.test.js.map