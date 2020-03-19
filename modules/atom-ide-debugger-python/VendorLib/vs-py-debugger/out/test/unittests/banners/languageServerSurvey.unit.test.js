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
const semver_1 = require("semver");
const typemoq = require("typemoq");
const languageServerSurveyBanner_1 = require("../../../client/languageServices/languageServerSurveyBanner");
suite('Language Server Survey Banner', () => {
    let config;
    let appShell;
    let browser;
    let lsService;
    const message = 'Can you please take 2 minutes to tell us how the Experimental Debugger is working for you?';
    const yes = 'Yes, take survey now';
    const no = 'No, thanks';
    setup(() => {
        config = typemoq.Mock.ofType();
        appShell = typemoq.Mock.ofType();
        browser = typemoq.Mock.ofType();
        lsService = typemoq.Mock.ofType();
    });
    test('Is debugger enabled upon creation?', () => {
        const enabledValue = true;
        const attemptCounter = 0;
        const completionsCount = 0;
        const testBanner = preparePopup(attemptCounter, completionsCount, enabledValue, 0, 100, appShell.object, browser.object, lsService.object);
        chai_1.expect(testBanner.enabled).to.be.equal(true, 'Sampling 100/100 should always enable the banner.');
    });
    test('Do not show banner when it is disabled', () => {
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no)))
            .verifiable(typemoq.Times.never());
        const enabledValue = true;
        const attemptCounter = 0;
        const completionsCount = 0;
        const testBanner = preparePopup(attemptCounter, completionsCount, enabledValue, 0, 0, appShell.object, browser.object, lsService.object);
        testBanner.showBanner().ignoreErrors();
    });
    test('shouldShowBanner must return false when Banner is implicitly disabled by sampling', () => {
        const enabledValue = true;
        const attemptCounter = 0;
        const completionsCount = 0;
        const testBanner = preparePopup(attemptCounter, completionsCount, enabledValue, 0, 0, appShell.object, browser.object, lsService.object);
        chai_1.expect(testBanner.enabled).to.be.equal(false, 'We implicitly disabled the banner, it should never show.');
    });
    const languageServerVersions = [
        '1.2.3',
        '1.2.3-alpha',
        '0.0.1234567890',
        '1234567890.0.1',
        '1.0.1-alpha+2',
        '22.4.999-rc.6'
    ];
    languageServerVersions.forEach((languageServerVersion) => __awaiter(this, void 0, void 0, function* () {
        test(`Survey URL is as expected for Language Server version '${languageServerVersion}'.`, () => __awaiter(this, void 0, void 0, function* () {
            const enabledValue = true;
            const attemptCounter = 42;
            const completionsCount = 0;
            // the expected URI as provided in issue #2630
            // with mocked-up test replacement values
            const expectedUri = `https://www.research.net/r/LJZV9BZ?n=${attemptCounter}&v=${encodeURIComponent(languageServerVersion)}`;
            const lsFolder = {
                path: '/some/path',
                version: new semver_1.SemVer(languageServerVersion, true)
            };
            // language service will get asked for the current Language
            // Server directory installed. This in turn will give the tested
            // code the version via the .version member of lsFolder.
            lsService.setup(f => f.getCurrentLanguageServerDirectory())
                .returns(() => {
                return Promise.resolve(lsFolder);
            })
                .verifiable(typemoq.Times.once());
            // The browser service will be asked to launch a URI that is
            // built using similar constants to those found in this test
            // suite. The exact built URI should be received in a single call
            // to launch.
            let receivedUri = '';
            browser.setup(b => b.launch(typemoq.It.is((a) => {
                receivedUri = a;
                return a === expectedUri;
            })))
                .verifiable(typemoq.Times.once());
            const testBanner = preparePopup(attemptCounter, completionsCount, enabledValue, 0, 0, appShell.object, browser.object, lsService.object);
            yield testBanner.launchSurvey();
            // This is technically not necessary, but it gives
            // better output than the .verifyAll messages do.
            chai_1.expect(receivedUri).is.equal(expectedUri, 'Uri given to launch mock is incorrect.');
            // verify that the calls expected were indeed made.
            lsService.verifyAll();
            browser.verifyAll();
            lsService.reset();
            browser.reset();
        }));
    }));
});
function preparePopup(attemptCounter, completionsCount, enabledValue, minCompletionCount, maxCompletionCount, appShell, browser, lsService) {
    const myfactory = typemoq.Mock.ofType();
    const enabledValState = typemoq.Mock.ofType();
    const attemptCountState = typemoq.Mock.ofType();
    const completionCountState = typemoq.Mock.ofType();
    enabledValState.setup(a => a.updateValue(typemoq.It.isValue(true))).returns(() => {
        enabledValue = true;
        return Promise.resolve();
    });
    enabledValState.setup(a => a.updateValue(typemoq.It.isValue(false))).returns(() => {
        enabledValue = false;
        return Promise.resolve();
    });
    attemptCountState.setup(a => a.updateValue(typemoq.It.isAnyNumber())).returns(() => {
        attemptCounter += 1;
        return Promise.resolve();
    });
    completionCountState.setup(a => a.updateValue(typemoq.It.isAnyNumber())).returns(() => {
        completionsCount += 1;
        return Promise.resolve();
    });
    enabledValState.setup(a => a.value).returns(() => enabledValue);
    attemptCountState.setup(a => a.value).returns(() => attemptCounter);
    completionCountState.setup(a => a.value).returns(() => completionsCount);
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(languageServerSurveyBanner_1.LSSurveyStateKeys.ShowBanner), typemoq.It.isValue(true))).returns(() => {
        return enabledValState.object;
    });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(languageServerSurveyBanner_1.LSSurveyStateKeys.ShowBanner), typemoq.It.isValue(false))).returns(() => {
        return enabledValState.object;
    });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(languageServerSurveyBanner_1.LSSurveyStateKeys.ShowAttemptCounter), typemoq.It.isAnyNumber())).returns(() => {
        return attemptCountState.object;
    });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(languageServerSurveyBanner_1.LSSurveyStateKeys.ShowAfterCompletionCount), typemoq.It.isAnyNumber())).returns(() => {
        return completionCountState.object;
    });
    return new languageServerSurveyBanner_1.LanguageServerSurveyBanner(appShell, myfactory.object, browser, lsService, minCompletionCount, maxCompletionCount);
}
//# sourceMappingURL=languageServerSurvey.unit.test.js.map