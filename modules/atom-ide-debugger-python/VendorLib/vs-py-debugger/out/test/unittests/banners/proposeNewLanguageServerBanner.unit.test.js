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
// tslint:disable:no-any max-func-body-length
const chai_1 = require("chai");
const typemoq = require("typemoq");
const proposeLanguageServerBanner_1 = require("../../../client/languageServices/proposeLanguageServerBanner");
suite('Propose New Language Server Banner', () => {
    let config;
    let appShell;
    const message = 'Try out Preview of our new Python Language Server to get richer and faster IntelliSense completions, and syntax errors as you type.';
    const yes = 'Try it now';
    const no = 'No thanks';
    const later = 'Remind me Later';
    setup(() => {
        config = typemoq.Mock.ofType();
        appShell = typemoq.Mock.ofType();
    });
    test('Is debugger enabled upon creation?', () => {
        const enabledValue = true;
        const testBanner = preparePopup(enabledValue, 100, appShell.object, config.object);
        chai_1.expect(testBanner.enabled).to.be.equal(true, 'Sampling 100/100 should always enable the banner.');
    });
    test('Do not show banner when it is disabled', () => {
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no), typemoq.It.isValue(later)))
            .verifiable(typemoq.Times.never());
        const enabled = true;
        const testBanner = preparePopup(enabled, 0, appShell.object, config.object);
        testBanner.showBanner().ignoreErrors();
    });
    test('shouldShowBanner must return false when Banner is implicitly disabled by sampling', () => {
        const enabled = true;
        const testBanner = preparePopup(enabled, 0, appShell.object, config.object);
        chai_1.expect(testBanner.enabled).to.be.equal(false, 'We implicitly disabled the banner, it should never show.');
    });
    test('shouldShowBanner must return false when Banner is explicitly disabled', () => __awaiter(this, void 0, void 0, function* () {
        const enabled = true;
        const testBanner = preparePopup(enabled, 100, appShell.object, config.object);
        chai_1.expect(yield testBanner.shouldShowBanner()).to.be.equal(true, '100% sample size should always make the banner enabled.');
        yield testBanner.disable();
        chai_1.expect(yield testBanner.shouldShowBanner()).to.be.equal(false, 'Explicitly disabled banner shouldShowBanner != false.');
    }));
});
function preparePopup(enabledValue, sampleValue, appShell, config) {
    const myfactory = typemoq.Mock.ofType();
    const val = typemoq.Mock.ofType();
    val.setup(a => a.updateValue(typemoq.It.isValue(true))).returns(() => {
        enabledValue = true;
        return Promise.resolve();
    });
    val.setup(a => a.updateValue(typemoq.It.isValue(false))).returns(() => {
        enabledValue = false;
        return Promise.resolve();
    });
    val.setup(a => a.value).returns(() => {
        return enabledValue;
    });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(proposeLanguageServerBanner_1.ProposeLSStateKeys.ShowBanner), typemoq.It.isValue(true)))
        .returns(() => {
        return val.object;
    });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(proposeLanguageServerBanner_1.ProposeLSStateKeys.ShowBanner), typemoq.It.isValue(false)))
        .returns(() => {
        return val.object;
    });
    return new proposeLanguageServerBanner_1.ProposeLanguageServerBanner(appShell, myfactory.object, config, sampleValue);
}
//# sourceMappingURL=proposeNewLanguageServerBanner.unit.test.js.map