// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
class TextRangeCollection {
    constructor(items) {
        this.items = items;
    }
    get start() {
        return this.items.length > 0 ? this.items[0].start : 0;
    }
    get end() {
        return this.items.length > 0 ? this.items[this.items.length - 1].end : 0;
    }
    get length() {
        return this.end - this.start;
    }
    get count() {
        return this.items.length;
    }
    contains(position) {
        return position >= this.start && position < this.end;
    }
    getItemAt(index) {
        if (index < 0 || index >= this.items.length) {
            throw new Error('index is out of range');
        }
        return this.items[index];
    }
    getItemAtPosition(position) {
        if (this.count === 0) {
            return -1;
        }
        if (position < this.start) {
            return -1;
        }
        if (position >= this.end) {
            return -1;
        }
        let min = 0;
        let max = this.count - 1;
        while (min <= max) {
            const mid = Math.floor(min + (max - min) / 2);
            const item = this.items[mid];
            if (item.start === position) {
                return mid;
            }
            if (position < item.start) {
                max = mid - 1;
            }
            else {
                min = mid + 1;
            }
        }
        return -1;
    }
    getItemContaining(position) {
        if (this.count === 0) {
            return -1;
        }
        if (position < this.start) {
            return -1;
        }
        if (position > this.end) {
            return -1;
        }
        let min = 0;
        let max = this.count - 1;
        while (min <= max) {
            const mid = Math.floor(min + (max - min) / 2);
            const item = this.items[mid];
            if (item.contains(position)) {
                return mid;
            }
            if (mid < this.count - 1 && item.end <= position && position < this.items[mid + 1].start) {
                return -1;
            }
            if (position < item.start) {
                max = mid - 1;
            }
            else {
                min = mid + 1;
            }
        }
        return -1;
    }
}
exports.TextRangeCollection = TextRangeCollection;
//# sourceMappingURL=textRangeCollection.js.map