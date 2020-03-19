"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
/**
 * Utilities for working with promises.
 */
class PromiseUtil {
    forEach(sourcesMaybePromise, promiseGenerator) {
        const sourcesPromise = Q(sourcesMaybePromise);
        return Q(sourcesPromise).then(sources => {
            return Q.all(sources.map(source => {
                return promiseGenerator(source);
            })).then(() => { });
        });
    }
    /**
     * Retries an operation a given number of times. For each retry, a condition is checked.
     * If the condition is not satisfied after the maximum number of retries, and error is thrown.
     * Otherwise, the result of the operation is returned once the condition is satisfied.
     *
     * @param operation - the function to execute.
     * @param condition - the condition to check between iterations.
     * @param maxRetries - the maximum number of retries.
     * @param delay - time between iterations, in milliseconds.
     * @param failure - error description.
     */
    retryAsync(operation, condition, maxRetries, delay, failure) {
        return this.retryAsyncIteration(operation, condition, maxRetries, 0, delay, failure);
    }
    reduce(sources, generateAsyncOperation) {
        const promisedSources = Q(sources);
        return promisedSources.then(resolvedSources => {
            return resolvedSources.reduce((previousReduction, newSource) => {
                return previousReduction.then(() => {
                    return generateAsyncOperation(newSource);
                });
            }, Q(void 0));
        });
    }
    retryAsyncIteration(operation, condition, maxRetries, iteration, delay, failure) {
        return operation()
            .then(result => {
            return Q(result).then(condition).then((conditionResult => {
                if (conditionResult) {
                    return result;
                }
                if (iteration < maxRetries) {
                    return Q.delay(delay).then(() => this.retryAsyncIteration(operation, condition, maxRetries, iteration + 1, delay, failure));
                }
                throw new Error(failure);
            }));
        });
    }
}
exports.PromiseUtil = PromiseUtil;

//# sourceMappingURL=promise.js.map
