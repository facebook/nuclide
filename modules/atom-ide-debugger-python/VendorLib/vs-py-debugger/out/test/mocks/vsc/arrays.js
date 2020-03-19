/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:all
var vscMockArrays;
(function (vscMockArrays) {
    /**
     * Returns the last element of an array.
     * @param array The array.
     * @param n Which element from the end (default is zero).
     */
    function tail(array, n = 0) {
        return array[array.length - (1 + n)];
    }
    vscMockArrays.tail = tail;
    function equals(one, other, itemEquals = (a, b) => a === b) {
        if (one.length !== other.length) {
            return false;
        }
        for (let i = 0, len = one.length; i < len; i++) {
            if (!itemEquals(one[i], other[i])) {
                return false;
            }
        }
        return true;
    }
    vscMockArrays.equals = equals;
    function binarySearch(array, key, comparator) {
        let low = 0, high = array.length - 1;
        while (low <= high) {
            let mid = ((low + high) / 2) | 0;
            let comp = comparator(array[mid], key);
            if (comp < 0) {
                low = mid + 1;
            }
            else if (comp > 0) {
                high = mid - 1;
            }
            else {
                return mid;
            }
        }
        return -(low + 1);
    }
    vscMockArrays.binarySearch = binarySearch;
    /**
     * Takes a sorted array and a function p. The array is sorted in such a way that all elements where p(x) is false
     * are located before all elements where p(x) is true.
     * @returns the least x for which p(x) is true or array.length if no element fullfills the given function.
     */
    function findFirst(array, p) {
        let low = 0, high = array.length;
        if (high === 0) {
            return 0; // no children
        }
        while (low < high) {
            let mid = Math.floor((low + high) / 2);
            if (p(array[mid])) {
                high = mid;
            }
            else {
                low = mid + 1;
            }
        }
        return low;
    }
    vscMockArrays.findFirst = findFirst;
    /**
     * Like `Array#sort` but always stable. Usually runs a little slower `than Array#sort`
     * so only use this when actually needing stable sort.
     */
    function mergeSort(data, compare) {
        _divideAndMerge(data, compare);
        return data;
    }
    vscMockArrays.mergeSort = mergeSort;
    function _divideAndMerge(data, compare) {
        if (data.length <= 1) {
            // sorted
            return;
        }
        const p = (data.length / 2) | 0;
        const left = data.slice(0, p);
        const right = data.slice(p);
        _divideAndMerge(left, compare);
        _divideAndMerge(right, compare);
        let leftIdx = 0;
        let rightIdx = 0;
        let i = 0;
        while (leftIdx < left.length && rightIdx < right.length) {
            let ret = compare(left[leftIdx], right[rightIdx]);
            if (ret <= 0) {
                // smaller_equal -> take left to preserve order
                data[i++] = left[leftIdx++];
            }
            else {
                // greater -> take right
                data[i++] = right[rightIdx++];
            }
        }
        while (leftIdx < left.length) {
            data[i++] = left[leftIdx++];
        }
        while (rightIdx < right.length) {
            data[i++] = right[rightIdx++];
        }
    }
    function groupBy(data, compare) {
        const result = [];
        let currentGroup;
        for (const element of mergeSort(data.slice(0), compare)) {
            if (!currentGroup || compare(currentGroup[0], element) !== 0) {
                currentGroup = [element];
                result.push(currentGroup);
            }
            else {
                currentGroup.push(element);
            }
        }
        return result;
    }
    vscMockArrays.groupBy = groupBy;
    /**
     * Diffs two *sorted* arrays and computes the splices which apply the diff.
     */
    function sortedDiff(before, after, compare) {
        const result = [];
        function pushSplice(start, deleteCount, toInsert) {
            if (deleteCount === 0 && toInsert.length === 0) {
                return;
            }
            const latest = result[result.length - 1];
            if (latest && latest.start + latest.deleteCount === start) {
                latest.deleteCount += deleteCount;
                latest.toInsert.push(...toInsert);
            }
            else {
                result.push({ start, deleteCount, toInsert });
            }
        }
        let beforeIdx = 0;
        let afterIdx = 0;
        while (true) {
            if (beforeIdx === before.length) {
                pushSplice(beforeIdx, 0, after.slice(afterIdx));
                break;
            }
            if (afterIdx === after.length) {
                pushSplice(beforeIdx, before.length - beforeIdx, []);
                break;
            }
            const beforeElement = before[beforeIdx];
            const afterElement = after[afterIdx];
            const n = compare(beforeElement, afterElement);
            if (n === 0) {
                // equal
                beforeIdx += 1;
                afterIdx += 1;
            }
            else if (n < 0) {
                // beforeElement is smaller -> before element removed
                pushSplice(beforeIdx, 1, []);
                beforeIdx += 1;
            }
            else if (n > 0) {
                // beforeElement is greater -> after element added
                pushSplice(beforeIdx, 0, [afterElement]);
                afterIdx += 1;
            }
        }
        return result;
    }
    vscMockArrays.sortedDiff = sortedDiff;
    /**
     * Takes two *sorted* arrays and computes their delta (removed, added elements).
     * Finishes in `Math.min(before.length, after.length)` steps.
     * @param before
     * @param after
     * @param compare
     */
    function delta(before, after, compare) {
        const splices = sortedDiff(before, after, compare);
        const removed = [];
        const added = [];
        for (const splice of splices) {
            removed.push(...before.slice(splice.start, splice.start + splice.deleteCount));
            added.push(...splice.toInsert);
        }
        return { removed, added };
    }
    vscMockArrays.delta = delta;
    /**
     * Returns the top N elements from the array.
     *
     * Faster than sorting the entire array when the array is a lot larger than N.
     *
     * @param array The unsorted array.
     * @param compare A sort function for the elements.
     * @param n The number of elements to return.
     * @return The first n elemnts from array when sorted with compare.
     */
    function top(array, compare, n) {
        if (n === 0) {
            return [];
        }
        const result = array.slice(0, n).sort(compare);
        topStep(array, compare, result, n, array.length);
        return result;
    }
    vscMockArrays.top = top;
    function topStep(array, compare, result, i, m) {
        for (const n = result.length; i < m; i++) {
            const element = array[i];
            if (compare(element, result[n - 1]) < 0) {
                result.pop();
                const j = findFirst(result, e => compare(element, e) < 0);
                result.splice(j, 0, element);
            }
        }
    }
    /**
     * @returns a new array with all undefined or null values removed. The original array is not modified at all.
     */
    function coalesce(array) {
        if (!array) {
            return array;
        }
        return array.filter(e => !!e);
    }
    vscMockArrays.coalesce = coalesce;
    /**
     * Moves the element in the array for the provided positions.
     */
    function move(array, from, to) {
        array.splice(to, 0, array.splice(from, 1)[0]);
    }
    vscMockArrays.move = move;
    /**
     * @returns {{false}} if the provided object is an array
     * 	and not empty.
     */
    function isFalsyOrEmpty(obj) {
        return !Array.isArray(obj) || obj.length === 0;
    }
    vscMockArrays.isFalsyOrEmpty = isFalsyOrEmpty;
    /**
     * Removes duplicates from the given array. The optional keyFn allows to specify
     * how elements are checked for equalness by returning a unique string for each.
     */
    function distinct(array, keyFn) {
        if (!keyFn) {
            return array.filter((element, position) => {
                return array.indexOf(element) === position;
            });
        }
        const seen = Object.create(null);
        return array.filter((elem) => {
            const key = keyFn(elem);
            if (seen[key]) {
                return false;
            }
            seen[key] = true;
            return true;
        });
    }
    vscMockArrays.distinct = distinct;
    function uniqueFilter(keyFn) {
        const seen = Object.create(null);
        return element => {
            const key = keyFn(element);
            if (seen[key]) {
                return false;
            }
            seen[key] = true;
            return true;
        };
    }
    vscMockArrays.uniqueFilter = uniqueFilter;
    function firstIndex(array, fn) {
        for (let i = 0; i < array.length; i++) {
            const element = array[i];
            if (fn(element)) {
                return i;
            }
        }
        return -1;
    }
    vscMockArrays.firstIndex = firstIndex;
    function first(array, fn, notFoundValue = null) {
        const index = firstIndex(array, fn);
        return index < 0 ? notFoundValue : array[index];
    }
    vscMockArrays.first = first;
    function commonPrefixLength(one, other, equals = (a, b) => a === b) {
        let result = 0;
        for (let i = 0, len = Math.min(one.length, other.length); i < len && equals(one[i], other[i]); i++) {
            result++;
        }
        return result;
    }
    vscMockArrays.commonPrefixLength = commonPrefixLength;
    function flatten(arr) {
        return [].concat(...arr);
    }
    vscMockArrays.flatten = flatten;
    function range(arg, to) {
        let from = typeof to === 'number' ? arg : 0;
        if (typeof to === 'number') {
            from = arg;
        }
        else {
            from = 0;
            to = arg;
        }
        const result = [];
        if (from <= to) {
            for (let i = from; i < to; i++) {
                result.push(i);
            }
        }
        else {
            for (let i = from; i > to; i--) {
                result.push(i);
            }
        }
        return result;
    }
    vscMockArrays.range = range;
    function fill(num, valueFn, arr = []) {
        for (let i = 0; i < num; i++) {
            arr[i] = valueFn();
        }
        return arr;
    }
    vscMockArrays.fill = fill;
    function index(array, indexer, merger = t => t) {
        return array.reduce((r, t) => {
            const key = indexer(t);
            r[key] = merger(t, r[key]);
            return r;
        }, Object.create(null));
    }
    vscMockArrays.index = index;
    /**
     * Inserts an element into an array. Returns a function which, when
     * called, will remove that element from the array.
     */
    function insert(array, element) {
        array.push(element);
        return () => {
            const index = array.indexOf(element);
            if (index > -1) {
                array.splice(index, 1);
            }
        };
    }
    vscMockArrays.insert = insert;
    /**
     * Insert `insertArr` inside `target` at `insertIndex`.
     * Please don't touch unless you understand https://jsperf.com/inserting-an-array-within-an-array
     */
    function arrayInsert(target, insertIndex, insertArr) {
        const before = target.slice(0, insertIndex);
        const after = target.slice(insertIndex);
        return before.concat(insertArr, after);
    }
    vscMockArrays.arrayInsert = arrayInsert;
})(vscMockArrays = exports.vscMockArrays || (exports.vscMockArrays = {}));
//# sourceMappingURL=arrays.js.map