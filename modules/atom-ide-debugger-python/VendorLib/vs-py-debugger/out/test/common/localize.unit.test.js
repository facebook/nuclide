// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const constants_1 = require("../../client/common/constants");
const localize = require("../../client/common/utils/localize");
// Defines a Mocha test suite to group tests of similar kind together
suite('localize tests', () => {
    test('keys', done => {
        const val = localize.LanguageServiceSurveyBanner.bannerMessage();
        assert.equal(val, 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?', 'LanguageServiceSurveyBanner string doesnt match');
        done();
    });
    test('keys italian', done => {
        // Force a config change
        process.env.VSCODE_NLS_CONFIG = '{ "locale": "it" }';
        const val = localize.LanguageServiceSurveyBanner.bannerLabelYes();
        assert.equal(val, 'Sì, prenderò il sondaggio ora', 'bannerLabelYes is not being translated');
        done();
    });
    test('keys exist', done => {
        // Read all of the namespaces from the localize import
        const entries = Object.keys(localize);
        // Read in the JSON object for the package.nls.json
        let nlsCollection = {};
        const defaultNlsFile = path.join(constants_1.EXTENSION_ROOT_DIR, 'package.nls.json');
        if (fs.existsSync(defaultNlsFile)) {
            const contents = fs.readFileSync(defaultNlsFile, 'utf8');
            nlsCollection = JSON.parse(contents);
        }
        else {
            nlsCollection = {};
        }
        // Now match all of our namespace entries to our nls entries
        entries.forEach((e) => {
            if (typeof localize[e] !== 'function') {
                // This must be a namespace. It should have functions inside of it
                const namespace = localize[e];
                const funcs = Object.keys(namespace);
                // Run every function, this should fill up our asked for keys collection
                funcs.forEach((f) => {
                    const func = namespace[f];
                    func();
                });
            }
        });
        // Now verify all of the asked for keys exist
        const askedFor = localize.getAskedForCollection();
        const missing = {};
        Object.keys(askedFor).forEach((key) => {
            // Now check that this key exists somewhere in the nls collection
            if (!nlsCollection[key]) {
                missing[key] = askedFor[key];
            }
        });
        // If any missing keys, output an error
        const missingKeys = Object.keys(missing);
        if (missingKeys && missingKeys.length > 0) {
            let message = 'Missing keys. Add the following to package.nls.json:\n';
            missingKeys.forEach((k) => {
                message = message.concat(`\t"${k}" : "${missing[k]}",\n`);
            });
            assert.fail(message);
        }
        done();
    });
});
//# sourceMappingURL=localize.unit.test.js.map