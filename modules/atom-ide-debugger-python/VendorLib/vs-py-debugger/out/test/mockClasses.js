"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MockOutputChannel {
    constructor(name) {
        this.name = name;
        this.output = '';
    }
    append(value) {
        this.output += value;
    }
    appendLine(value) { this.append(value); this.append('\n'); }
    // tslint:disable-next-line:no-empty
    clear() { }
    // tslint:disable-next-line:no-any
    show(x, y) {
        this.isShown = true;
    }
    hide() {
        this.isShown = false;
    }
    // tslint:disable-next-line:no-empty
    dispose() { }
}
exports.MockOutputChannel = MockOutputChannel;
class MockStatusBarItem {
    // tslint:disable-next-line:no-empty
    show() {
    }
    // tslint:disable-next-line:no-empty
    hide() {
    }
    // tslint:disable-next-line:no-empty
    dispose() {
    }
}
exports.MockStatusBarItem = MockStatusBarItem;
class MockLintingSettings {
}
exports.MockLintingSettings = MockLintingSettings;
//# sourceMappingURL=mockClasses.js.map