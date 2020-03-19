// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/**
 * Split a string using the cr and lf characters and return them as an array.
 * By default lines are trimmed and empty lines are removed.
 * @param {SplitLinesOptions=} splitOptions - Options used for splitting the string.
 */
String.prototype.splitLines = function (splitOptions = { removeEmptyEntries: true, trim: true }) {
    let lines = this.split(/\r?\n/g);
    if (splitOptions && splitOptions.trim) {
        lines = lines.map(line => line.trim());
    }
    if (splitOptions && splitOptions.removeEmptyEntries) {
        lines = lines.filter(line => line.length > 0);
    }
    return lines;
};
/**
 * Appropriately formats a string so it can be used as an argument for a command in a shell.
 * E.g. if an argument contains a space, then it will be enclosed within double quotes.
 * @param {String} value.
 */
String.prototype.toCommandArgument = function () {
    if (!this) {
        return this;
    }
    return (this.indexOf(' ') >= 0 && !this.startsWith('"') && !this.endsWith('"')) ? `"${this}"` : this.toString();
};
/**
 * Appropriately formats a a file path so it can be used as an argument for a command in a shell.
 * E.g. if an argument contains a space, then it will be enclosed within double quotes.
 */
String.prototype.fileToCommandArgument = function () {
    if (!this) {
        return this;
    }
    return this.toCommandArgument().replace(/\\/g, '/');
};
/**
 * Explicitly tells that promise should be run asynchonously.
 */
Promise.prototype.ignoreErrors = function () {
    // tslint:disable-next-line:no-empty
    this.catch(() => { });
};
if (!String.prototype.format) {
    String.prototype.format = function () {
        const args = arguments;
        return this.replace(/{(\d+)}/g, (match, number) => args[number] === undefined ? match : args[number]);
    };
}
//# sourceMappingURL=extensions.js.map