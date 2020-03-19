"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const qr = require("qr-image");
class QRCodeContentProvider {
    constructor() {
        this.cache = {};
    }
    provideTextDocumentContent(uri, token) {
        let stringUri = uri.toString();
        if (!this.cache[stringUri]) {
            const imageBuffer = qr.imageSync(stringUri);
            this.cache[stringUri] = "data:image/png;base64," + imageBuffer.toString("base64");
        }
        return `<!DOCTYPE html>
        <html>
        <body>
            <div style="text-align:center">
                <h3>
                    Expo is running. Open your Expo app at<br/>
                    <span style="text-decoration: underline">${stringUri}</span><br/>
                    or scan QR code below:
                <h3>
                <img src="${this.cache[stringUri]}" />
            </div>
        </body>
        </html>`;
    }
}
exports.QRCodeContentProvider = QRCodeContentProvider;

//# sourceMappingURL=qrCodeContentProvider.js.map
