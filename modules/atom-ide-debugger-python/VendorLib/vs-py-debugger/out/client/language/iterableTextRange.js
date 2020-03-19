// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
class IterableTextRange {
    constructor(textRangeCollection) {
        this.textRangeCollection = textRangeCollection;
    }
    [Symbol.iterator]() {
        let index = -1;
        return {
            next: () => {
                if (index < this.textRangeCollection.count - 1) {
                    return {
                        done: false,
                        value: this.textRangeCollection.getItemAt(index += 1)
                    };
                }
                else {
                    return {
                        done: true,
                        // tslint:disable-next-line:no-any
                        value: undefined
                    };
                }
            }
        };
    }
}
exports.IterableTextRange = IterableTextRange;
//# sourceMappingURL=iterableTextRange.js.map