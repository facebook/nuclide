"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../common/types");
const stopWatch_1 = require("../common/utils/stopWatch");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
const baseFormatter_1 = require("./baseFormatter");
class YapfFormatter extends baseFormatter_1.BaseFormatter {
    constructor(serviceContainer) {
        super('yapf', types_1.Product.yapf, serviceContainer);
    }
    formatDocument(document, options, token, range) {
        const stopWatch = new stopWatch_1.StopWatch();
        const settings = this.serviceContainer.get(types_1.IConfigurationService).getSettings(document.uri);
        const hasCustomArgs = Array.isArray(settings.formatting.yapfArgs) && settings.formatting.yapfArgs.length > 0;
        const formatSelection = range ? !range.isEmpty : false;
        const yapfArgs = ['--diff'];
        if (formatSelection) {
            // tslint:disable-next-line:no-non-null-assertion
            yapfArgs.push(...['--lines', `${range.start.line + 1}-${range.end.line + 1}`]);
        }
        // Yapf starts looking for config file starting from the file path.
        const fallbarFolder = this.getWorkspaceUri(document).fsPath;
        const cwd = this.getDocumentPath(document, fallbarFolder);
        const promise = super.provideDocumentFormattingEdits(document, options, token, yapfArgs, cwd);
        telemetry_1.sendTelemetryWhenDone(constants_1.FORMAT, promise, stopWatch, { tool: 'yapf', hasCustomArgs, formatSelection });
        return promise;
    }
}
exports.YapfFormatter = YapfFormatter;
//# sourceMappingURL=yapfFormatter.js.map