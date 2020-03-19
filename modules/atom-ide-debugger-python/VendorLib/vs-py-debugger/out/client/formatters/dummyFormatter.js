"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../common/types");
const baseFormatter_1 = require("./baseFormatter");
class DummyFormatter extends baseFormatter_1.BaseFormatter {
    constructor(serviceContainer) {
        super('none', types_1.Product.yapf, serviceContainer);
    }
    formatDocument(document, options, token, range) {
        return Promise.resolve([]);
    }
}
exports.DummyFormatter = DummyFormatter;
//# sourceMappingURL=dummyFormatter.js.map