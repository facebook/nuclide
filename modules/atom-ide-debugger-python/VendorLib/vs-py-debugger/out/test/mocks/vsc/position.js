/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:all
var vscMockPosition;
(function (vscMockPosition) {
    /**
     * A position in the editor.
     */
    class Position {
        constructor(lineNumber, column) {
            this.lineNumber = lineNumber;
            this.column = column;
        }
        /**
         * Test if this position equals other position
         */
        equals(other) {
            return Position.equals(this, other);
        }
        /**
         * Test if position `a` equals position `b`
         */
        static equals(a, b) {
            if (!a && !b) {
                return true;
            }
            return (!!a &&
                !!b &&
                a.lineNumber === b.lineNumber &&
                a.column === b.column);
        }
        /**
         * Test if this position is before other position.
         * If the two positions are equal, the result will be false.
         */
        isBefore(other) {
            return Position.isBefore(this, other);
        }
        /**
         * Test if position `a` is before position `b`.
         * If the two positions are equal, the result will be false.
         */
        static isBefore(a, b) {
            if (a.lineNumber < b.lineNumber) {
                return true;
            }
            if (b.lineNumber < a.lineNumber) {
                return false;
            }
            return a.column < b.column;
        }
        /**
         * Test if this position is before other position.
         * If the two positions are equal, the result will be true.
         */
        isBeforeOrEqual(other) {
            return Position.isBeforeOrEqual(this, other);
        }
        /**
         * Test if position `a` is before position `b`.
         * If the two positions are equal, the result will be true.
         */
        static isBeforeOrEqual(a, b) {
            if (a.lineNumber < b.lineNumber) {
                return true;
            }
            if (b.lineNumber < a.lineNumber) {
                return false;
            }
            return a.column <= b.column;
        }
        /**
         * A function that compares positions, useful for sorting
         */
        static compare(a, b) {
            let aLineNumber = a.lineNumber | 0;
            let bLineNumber = b.lineNumber | 0;
            if (aLineNumber === bLineNumber) {
                let aColumn = a.column | 0;
                let bColumn = b.column | 0;
                return aColumn - bColumn;
            }
            return aLineNumber - bLineNumber;
        }
        /**
         * Clone this position.
         */
        clone() {
            return new Position(this.lineNumber, this.column);
        }
        /**
         * Convert to a human-readable representation.
         */
        toString() {
            return '(' + this.lineNumber + ',' + this.column + ')';
        }
        // ---
        /**
         * Create a `Position` from an `IPosition`.
         */
        static lift(pos) {
            return new Position(pos.lineNumber, pos.column);
        }
        /**
         * Test if `obj` is an `IPosition`.
         */
        static isIPosition(obj) {
            return (obj
                && (typeof obj.lineNumber === 'number')
                && (typeof obj.column === 'number'));
        }
    }
    vscMockPosition.Position = Position;
})(vscMockPosition = exports.vscMockPosition || (exports.vscMockPosition = {}));
//# sourceMappingURL=position.js.map