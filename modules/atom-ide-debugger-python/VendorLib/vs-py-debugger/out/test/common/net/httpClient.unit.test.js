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
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const types_1 = require("../../../client/common/application/types");
const httpClient_1 = require("../../../client/common/net/httpClient");
suite('Http Client', () => {
    test('Get proxy info', () => __awaiter(this, void 0, void 0, function* () {
        const container = TypeMoq.Mock.ofType();
        const workSpaceService = TypeMoq.Mock.ofType();
        const config = TypeMoq.Mock.ofType();
        const proxy = 'https://myproxy.net:4242';
        config
            .setup(c => c.get(TypeMoq.It.isValue('proxy'), TypeMoq.It.isValue('')))
            .returns(() => proxy)
            .verifiable(TypeMoq.Times.once());
        workSpaceService
            .setup(w => w.getConfiguration(TypeMoq.It.isValue('http')))
            .returns(() => config.object)
            .verifiable(TypeMoq.Times.once());
        container.setup(a => a.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workSpaceService.object);
        const httpClient = new httpClient_1.HttpClient(container.object);
        config.verifyAll();
        workSpaceService.verifyAll();
        chai_1.expect(httpClient.requestOptions).to.deep.equal({ proxy: proxy });
    }));
});
//# sourceMappingURL=httpClient.unit.test.js.map