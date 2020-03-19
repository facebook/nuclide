"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const path = require("path");
// import { DebugProtocol } from 'vscode-debugprotocol';
const testSetup = require("./testSetup");
const DATA_ROOT = testSetup.DATA_ROOT;
suite('Variables', () => {
    let dc;
    setup(() => {
        return testSetup.setup()
            .then(_dc => dc = _dc);
    });
    teardown(() => {
        return testSetup.teardown();
    });
    test('retrieves props of a large buffer', () => __awaiter(this, void 0, void 0, function* () {
        const PROGRAM = path.join(DATA_ROOT, 'large-buffer/largeBuffer.js');
        yield dc.hitBreakpoint({ program: PROGRAM }, { path: PROGRAM, line: 2 });
        const stack = yield dc.stackTraceRequest();
        assert(stack.body.stackFrames && stack.body.stackFrames.length > 0, 'Did not return any stackframes');
        const firstFrameId = stack.body.stackFrames[0].id;
        const scopes = yield dc.scopesRequest({ frameId: firstFrameId });
        assert(scopes.body.scopes && scopes.body.scopes.length > 0, 'Did not return any scopes');
        const localScope = scopes.body.scopes[0];
        const localScopeVars = yield dc.variablesRequest({ variablesReference: localScope.variablesReference });
        const bufferVar = localScopeVars.body.variables.find(vbl => vbl.name === 'buffer');
        assert(bufferVar, 'Did not return a var named buffer');
        assert(bufferVar.indexedVariables > 0, 'Must return some indexedVariables');
        assert(bufferVar.namedVariables === 0, 'Must not return namedVariables');
        const bufferProps = yield dc.variablesRequest({ variablesReference: bufferVar.variablesReference, filter: 'indexed', start: 0, count: 100 });
        // Just assert that something is returned, and that the last request doesn't fail or time out
        assert(bufferProps.body.variables.length > 0, 'Some variables must be returned');
    }));
});

//# sourceMappingURL=variables.test.js.map
