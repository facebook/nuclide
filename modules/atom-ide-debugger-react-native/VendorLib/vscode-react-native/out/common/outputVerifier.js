"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
/* This class transforms a spawn process to only succeed if all defined success patterns
   are found on stdout, and none of the failure patterns were found on stderr */
class OutputVerifier {
    constructor(generatePatternsForSuccess, generatePatternToFailure) {
        this.output = "";
        this.errors = "";
        this.generatePatternsForSuccess = generatePatternsForSuccess;
        this.generatePatternToFailure = generatePatternToFailure;
    }
    process(spawnResult) {
        // Store all output
        this.store(spawnResult.stdout, new_content => this.output += new_content);
        this.store(spawnResult.stderr, new_content => this.errors += new_content);
        return spawnResult.outcome // Wait for the process to finish
            .then(this.generatePatternToFailure) // Generate the failure patterns to check
            .then(patterns => {
            const failureMessage = this.findAnyFailurePattern(patterns);
            if (failureMessage) {
                return Q.reject(new Error(failureMessage)); // If at least one failure happened, we fail
            }
            else {
                return this.generatePatternsForSuccess(); // If not we generate the success patterns
            }
        }).then(successPatterns => {
            if (!this.areAllSuccessPatternsPresent(successPatterns)) {
                return Q.reject(new Error("Unknown error: not all success patterns were matched"));
            } // else we found all the success patterns, so we succeed
            return Q.resolve(void 0);
        });
    }
    store(stream, append) {
        stream.on("data", (data) => {
            append(data.toString());
        });
    }
    // We check the failure patterns one by one, to see if any of those appeared on the errors. If they did, we return the associated error
    findAnyFailurePattern(patterns) {
        const errorsAndOutput = this.errors + this.output;
        const patternThatAppeared = patterns.find(pattern => {
            return pattern.pattern instanceof RegExp ?
                pattern.pattern.test(errorsAndOutput) :
                errorsAndOutput.indexOf(pattern.pattern) !== -1;
        });
        return patternThatAppeared ? patternThatAppeared.message : null;
    }
    // We check that all the patterns appeared on the output
    areAllSuccessPatternsPresent(successPatterns) {
        return successPatterns.every(pattern => {
            let patternRe = new RegExp(pattern, "i");
            return patternRe.test(this.output);
        });
    }
}
exports.OutputVerifier = OutputVerifier;

//# sourceMappingURL=outputVerifier.js.map
