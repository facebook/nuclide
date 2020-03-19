"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MockMemento {
    constructor() {
        this.map = new Map();
    }
    get(key, defaultValue) {
        const exists = this.map.has(key);
        // tslint:disable-next-line:no-any
        return exists ? this.map.get(key) : defaultValue;
    }
    // tslint:disable-next-line:no-any
    update(key, value) {
        this.map.set(key, value);
        return Promise.resolve();
    }
}
exports.MockMemento = MockMemento;
//# sourceMappingURL=mementos.js.map