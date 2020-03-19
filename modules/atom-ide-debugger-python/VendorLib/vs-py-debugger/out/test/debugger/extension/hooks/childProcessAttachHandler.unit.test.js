// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any
const ts_mockito_1 = require("ts-mockito");
const childProcessAttachHandler_1 = require("../../../../client/debugger/extension/hooks/childProcessAttachHandler");
const childProcessAttachService_1 = require("../../../../client/debugger/extension/hooks/childProcessAttachService");
const constants_1 = require("../../../../client/debugger/extension/hooks/constants");
suite('Debug - Child Process', () => {
    test('Do not attach to child process if event is invalid', () => __awaiter(this, void 0, void 0, function* () {
        const attachService = ts_mockito_1.mock(childProcessAttachService_1.ChildProcessAttachService);
        const handler = new childProcessAttachHandler_1.ChildProcessAttachEventHandler(ts_mockito_1.instance(attachService));
        const body = {};
        yield handler.handleCustomEvent({ event: 'abc', body, session: {} });
        ts_mockito_1.verify(attachService.attach(body)).never();
    }));
    test('Do not attach to child process if event is invalid', () => __awaiter(this, void 0, void 0, function* () {
        const attachService = ts_mockito_1.mock(childProcessAttachService_1.ChildProcessAttachService);
        const handler = new childProcessAttachHandler_1.ChildProcessAttachEventHandler(ts_mockito_1.instance(attachService));
        const body = {};
        yield handler.handleCustomEvent({ event: constants_1.PTVSDEvents.ChildProcessLaunched, body, session: {} });
        ts_mockito_1.verify(attachService.attach(body)).once();
    }));
    test('Exceptions are not bubbled up if data is invalid', () => __awaiter(this, void 0, void 0, function* () {
        const attachService = ts_mockito_1.mock(childProcessAttachService_1.ChildProcessAttachService);
        const handler = new childProcessAttachHandler_1.ChildProcessAttachEventHandler(ts_mockito_1.instance(attachService));
        yield handler.handleCustomEvent(undefined);
    }));
    test('Exceptions are not bubbled up if exceptions are thrown', () => __awaiter(this, void 0, void 0, function* () {
        const attachService = ts_mockito_1.mock(childProcessAttachService_1.ChildProcessAttachService);
        const handler = new childProcessAttachHandler_1.ChildProcessAttachEventHandler(ts_mockito_1.instance(attachService));
        const body = {};
        ts_mockito_1.when(attachService.attach(body)).thenThrow(new Error('Kaboom'));
        yield handler.handleCustomEvent({ event: constants_1.PTVSDEvents.ChildProcessLaunched, body, session: {} });
        ts_mockito_1.verify(attachService.attach(body)).once();
    }));
});
//# sourceMappingURL=childProcessAttachHandler.unit.test.js.map