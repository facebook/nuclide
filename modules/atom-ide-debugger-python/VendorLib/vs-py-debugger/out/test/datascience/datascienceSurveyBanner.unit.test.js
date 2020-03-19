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
const dataScienceSurveyBanner_1 = require("../../client/datascience/dataScienceSurveyBanner");
suite('Data Science Survey Banner', () => {
    let appShell;
    let browser;
    const targetUri = 'https://microsoft.com';
    const message = 'Can you please take 2 minutes to tell us how the Python Data Science features are working for you?';
    const yes = 'Yes, take survey now';
    const no = 'No, thanks';
    setup(() => {
        appShell = typemoq.Mock.ofType();
        browser = typemoq.Mock.ofType();
    });
    test('Data science banner should be enabled after we hit our command execution count', () => __awaiter(this, void 0, void 0, function* () {
        const enabledValue = true;
        const attemptCounter = 1000;
        const testBanner = preparePopup(attemptCounter, enabledValue, 0, appShell.object, browser.object, targetUri);
        const expectedUri = targetUri;
        let receivedUri = '';
        browser.setup(b => b.launch(typemoq.It.is((a) => {
            receivedUri = a;
            return a === expectedUri;
        }))).verifiable(typemoq.Times.once());
        yield testBanner.launchSurvey();
        // This is technically not necessary, but it gives
        // better output than the .verifyAll messages do.
        chai_1.expect(receivedUri).is.equal(expectedUri, 'Uri given to launch mock is incorrect.');
        // verify that the calls expected were indeed made.
        browser.verifyAll();
        browser.reset();
    }));
    test('Do not show data science banner when it is disabled', () => {
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no)))
            .verifiable(typemoq.Times.never());
        const enabledValue = false;
        const attemptCounter = 0;
        const testBanner = preparePopup(attemptCounter, enabledValue, 0, appShell.object, browser.object, targetUri);
        testBanner.showBanner().ignoreErrors();
    });
    test('Do not show data science banner if we have not hit our command count', () => {
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no)))
            .verifiable(typemoq.Times.never());
        const enabledValue = true;
        const attemptCounter = 100;
        const testBanner = preparePopup(attemptCounter, enabledValue, 1000, appShell.object, browser.object, targetUri);
        testBanner.showBanner().ignoreErrors();
    });
});
function preparePopup(commandCounter, enabledValue, commandThreshold, appShell, browser, targetUri) {
    const myfactory = typemoq.Mock.ofType();
    const enabledValState = typemoq.Mock.ofType();
    const attemptCountState = typemoq.Mock.ofType();
    enabledValState.setup(a => a.updateValue(typemoq.It.isValue(true))).returns(() => {
        enabledValue = true;
        return Promise.resolve();
    });
    enabledValState.setup(a => a.updateValue(typemoq.It.isValue(false))).returns(() => {
        enabledValue = false;
        return Promise.resolve();
    });
    attemptCountState.setup(a => a.updateValue(typemoq.It.isAnyNumber())).returns(() => {
        commandCounter += 1;
        return Promise.resolve();
    });
    enabledValState.setup(a => a.value).returns(() => enabledValue);
    attemptCountState.setup(a => a.value).returns(() => commandCounter);
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(dataScienceSurveyBanner_1.DSSurveyStateKeys.ShowBanner), typemoq.It.isValue(true))).returns(() => {
        return enabledValState.object;
    });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(dataScienceSurveyBanner_1.DSSurveyStateKeys.ShowBanner), typemoq.It.isValue(false))).returns(() => {
        return enabledValState.object;
    });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(dataScienceSurveyBanner_1.DSSurveyStateKeys.ShowAttemptCounter), typemoq.It.isAnyNumber())).returns(() => {
        return attemptCountState.object;
    });
    return new dataScienceSurveyBanner_1.DataScienceSurveyBanner(appShell, myfactory.object, browser, commandThreshold, targetUri);
}
//# sourceMappingURL=datascienceSurveyBanner.unit.test.js.map