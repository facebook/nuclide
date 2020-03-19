/* tslint:disable */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// This code is from @nteract/transforms-full except without the Vega transforms:
// https://github.com/nteract/nteract/blob/v0.12.2/packages/transforms-full/src/index.js .
// Vega transforms mess up our npm pkg install because they rely on the npm canvas module that needs
// to be built on each system.
const transform_plotly_1 = require("@nteract/transform-plotly");
const transform_geojson_1 = require("@nteract/transform-geojson");
const transform_model_debug_1 = require("@nteract/transform-model-debug");
const transform_dataresource_1 = require("@nteract/transform-dataresource");
// import { VegaLite1, VegaLite2, Vega2, Vega3 } from "@nteract/transform-vega";
const transforms_1 = require("@nteract/transforms");
exports.registerTransform = transforms_1.registerTransform;
exports.richestMimetype = transforms_1.richestMimetype;
const additionalTransforms = [
    transform_dataresource_1.default,
    transform_model_debug_1.default,
    transform_plotly_1.PlotlyNullTransform,
    transform_plotly_1.default,
    transform_geojson_1.default,
];
const { transforms, displayOrder } = additionalTransforms.reduce(transforms_1.registerTransform, {
    transforms: transforms_1.standardTransforms,
    displayOrder: transforms_1.standardDisplayOrder
});
exports.transforms = transforms;
exports.displayOrder = displayOrder;
//# sourceMappingURL=transforms.js.map