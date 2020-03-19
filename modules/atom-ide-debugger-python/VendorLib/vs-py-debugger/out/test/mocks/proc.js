"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
require("rxjs/add/observable/of");
const Observable_1 = require("rxjs/Observable");
exports.IOriginalProcessService = Symbol('IProcessService');
class MockProcessService extends events_1.EventEmitter {
    constructor(procService) {
        super();
        this.procService = procService;
    }
    onExecObservable(handler) {
        this.on('execObservable', handler);
    }
    execObservable(file, args, options = {}) {
        let value;
        let valueReturned = false;
        this.emit('execObservable', file, args, options, (result) => { value = result; valueReturned = true; });
        if (valueReturned) {
            const output = value;
            if (['stderr', 'stdout'].some(source => source === output.source)) {
                return {
                    // tslint:disable-next-line:no-any
                    proc: {},
                    out: Observable_1.Observable.of(output)
                };
            }
            else {
                return {
                    // tslint:disable-next-line:no-any
                    proc: {},
                    out: value
                };
            }
        }
        else {
            return this.procService.execObservable(file, args, options);
        }
    }
    onExec(handler) {
        this.on('exec', handler);
    }
    exec(file, args, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            let value;
            let valueReturned = false;
            this.emit('exec', file, args, options, (result) => { value = result; valueReturned = true; });
            return valueReturned ? value : this.procService.exec(file, args, options);
        });
    }
}
exports.MockProcessService = MockProcessService;
//# sourceMappingURL=proc.js.map