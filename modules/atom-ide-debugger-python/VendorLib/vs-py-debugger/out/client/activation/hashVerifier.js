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
const crypto_1 = require("crypto");
const fs = require("fs");
const async_1 = require("../common/utils/async");
class HashVerifier {
    verifyHash(filePath, platformString, expectedDigest) {
        return __awaiter(this, void 0, void 0, function* () {
            const readStream = fs.createReadStream(filePath);
            const deferred = async_1.createDeferred();
            const hash = crypto_1.createHash('sha512');
            hash.setEncoding('hex');
            readStream
                .on('end', () => {
                hash.end();
                deferred.resolve();
            })
                .on('error', (err) => {
                deferred.reject(`Unable to calculate file hash. Error ${err}`);
            });
            readStream.pipe(hash);
            yield deferred.promise;
            const actual = hash.read();
            return expectedDigest === platformString ? true : actual.toLowerCase() === expectedDigest.toLowerCase();
        });
    }
}
exports.HashVerifier = HashVerifier;
//# sourceMappingURL=hashVerifier.js.map