"use strict";
// tslint:disable:no-console
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var Logger_1;
const inversify_1 = require("inversify");
const helpers_1 = require("./helpers");
const types_1 = require("./types");
const PREFIX = 'Python Extension: ';
let Logger = Logger_1 = class Logger {
    // tslint:disable-next-line:no-any
    static error(title = '', message) {
        new Logger_1().logError(`${title}, ${message}`);
    }
    // tslint:disable-next-line:no-any
    static warn(title = '', message = '') {
        new Logger_1().logWarning(`${title}, ${message}`);
    }
    // tslint:disable-next-line:no-any
    static verbose(title = '') {
        new Logger_1().logInformation(title);
    }
    logError(message, ex) {
        if (ex) {
            console.error(`${PREFIX}${message}`, ex);
        }
        else {
            console.error(`${PREFIX}${message}`);
        }
    }
    logWarning(message, ex) {
        if (ex) {
            console.warn(`${PREFIX}${message}`, ex);
        }
        else {
            console.warn(`${PREFIX}${message}`);
        }
    }
    logInformation(message, ex) {
        if (ex) {
            console.info(`${PREFIX}${message}`, ex);
        }
        else {
            console.info(`${PREFIX}${message}`);
        }
    }
};
__decorate([
    helpers_1.skipIfTest(false)
], Logger.prototype, "logError", null);
__decorate([
    helpers_1.skipIfTest(false)
], Logger.prototype, "logWarning", null);
__decorate([
    helpers_1.skipIfTest(false)
], Logger.prototype, "logInformation", null);
Logger = Logger_1 = __decorate([
    inversify_1.injectable()
], Logger);
exports.Logger = Logger;
var LogOptions;
(function (LogOptions) {
    LogOptions[LogOptions["None"] = 0] = "None";
    LogOptions[LogOptions["Arguments"] = 1] = "Arguments";
    LogOptions[LogOptions["ReturnValue"] = 2] = "ReturnValue";
})(LogOptions || (LogOptions = {}));
// tslint:disable-next-line:no-any
function argsToLogString(args) {
    try {
        return (args || []).map((item, index) => {
            try {
                return `Arg ${index + 1}: ${JSON.stringify(item)}`;
            }
            catch (_a) {
                return `Arg ${index + 1}: UNABLE TO DETERMINE VALUE`;
            }
        }).join(', ');
    }
    catch (_a) {
        return '';
    }
}
// tslint:disable-next-line:no-any
function returnValueToLogString(returnValue) {
    let returnValueMessage = 'Return Value: ';
    if (returnValue) {
        try {
            returnValueMessage += `${JSON.stringify(returnValue)}`;
        }
        catch (_a) {
            returnValueMessage += 'UNABLE TO DETERMINE VALUE';
        }
    }
    return returnValueMessage;
}
function traceVerbose(message) {
    return trace(message, LogOptions.Arguments | LogOptions.ReturnValue);
}
exports.traceVerbose = traceVerbose;
function traceError(message, ex) {
    return trace(message, LogOptions.Arguments | LogOptions.ReturnValue, types_1.LogLevel.Error);
}
exports.traceError = traceError;
function traceInfo(message) {
    return trace(message);
}
exports.traceInfo = traceInfo;
function trace(message, options = LogOptions.None, logLevel) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (_, __, descriptor) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args) {
            // tslint:disable-next-line:no-any
            function writeSuccess(returnValue) {
                if (logLevel === types_1.LogLevel.Error) {
                    return;
                }
                writeToLog(returnValue);
            }
            function writeError(ex) {
                writeToLog(undefined, ex);
            }
            // tslint:disable-next-line:no-any
            function writeToLog(returnValue, ex) {
                const messagesToLog = [message];
                if ((options && LogOptions.Arguments) === LogOptions.Arguments) {
                    messagesToLog.push(argsToLogString(args));
                }
                if ((options & LogOptions.ReturnValue) === LogOptions.ReturnValue) {
                    messagesToLog.push(returnValueToLogString(returnValue));
                }
                if (ex) {
                    new Logger().logError(messagesToLog.join(', '), ex);
                }
                else {
                    new Logger().logInformation(messagesToLog.join(', '));
                }
            }
            try {
                // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
                const result = originalMethod.apply(this, args);
                // If method being wrapped returns a promise then wait for it.
                // tslint:disable-next-line:no-unsafe-any
                if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                    // tslint:disable-next-line:prefer-type-cast
                    result
                        .then(data => {
                        writeSuccess(data);
                        return data;
                    })
                        .catch(ex => {
                        writeError(ex);
                        return Promise.reject(ex);
                    });
                }
                else {
                    writeSuccess(result);
                }
                return result;
            }
            catch (ex) {
                writeError(ex);
                throw ex;
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=logger.js.map