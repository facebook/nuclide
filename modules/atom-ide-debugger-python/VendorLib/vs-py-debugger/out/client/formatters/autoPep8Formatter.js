"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const productInstaller_1 = require("../common/installer/productInstaller");
const types_1 = require("../common/types");
const stopWatch_1 = require("../common/utils/stopWatch");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
const baseFormatter_1 = require("./baseFormatter");
class AutoPep8Formatter extends baseFormatter_1.BaseFormatter {
    constructor(serviceContainer) {
        super('autopep8', productInstaller_1.Product.autopep8, serviceContainer);
    }
    formatDocument(document, options, token, range) {
        const stopWatch = new stopWatch_1.StopWatch();
        const settings = this.serviceContainer.get(types_1.IConfigurationService).getSettings(document.uri);
        const hasCustomArgs = Array.isArray(settings.formatting.autopep8Args) && settings.formatting.autopep8Args.length > 0;
        const formatSelection = range ? !range.isEmpty : false;
        const autoPep8Args = ['--diff'];
        if (formatSelection) {
            // tslint:disable-next-line:no-non-null-assertion
            autoPep8Args.push(...['--line-range', (range.start.line + 1).toString(), (range.end.line + 1).toString()]);
        }
        const promise = super.provideDocumentFormattingEdits(document, options, token, autoPep8Args);
        telemetry_1.sendTelemetryWhenDone(constants_1.FORMAT, promise, stopWatch, { tool: 'autopep8', hasCustomArgs, formatSelection });
        return promise;
    }
}
exports.AutoPep8Formatter = AutoPep8Formatter;
//# sourceMappingURL=autoPep8Formatter.js.map