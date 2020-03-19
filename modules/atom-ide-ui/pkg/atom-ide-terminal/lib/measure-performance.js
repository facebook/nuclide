/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import {remote} from 'electron';
import featureConfig from 'nuclide-commons-atom/feature-config';
import performanceNow from 'nuclide-commons/performanceNow';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Terminal as XTerminal} from 'vscode-xterm';
import {track} from 'nuclide-commons/analytics';
import {RENDERER_TYPE_CONFIG} from './config';

// Tune the parameters for performance measurement.
const SLOW_CANVAS_RENDER_THRESHOLD = 66; // in ms
// Always measure a certain number of initial frames.
const INITIAL_FRAMES_TO_MEASURE = 20;
// But keep sampling after that.
const FRAME_SAMPLE_RATE = 10;
// Take the average of the last N frames.
const FRAME_BUFFER_SIZE = INITIAL_FRAMES_TO_MEASURE;

/**
 * Track the performance of both terminal renderers and offer switching to
 * the DOM-based fallback if we detect slow canvas rendering in an environment
 * that doesn't support it well.
 */
export default function measurePerformance(terminal: XTerminal): IDisposable {
  const rendererType = terminal.getOption('rendererType');
  const rendererConfig = featureConfig.get(RENDERER_TYPE_CONFIG);
  const supportsAcceleratedCanvas =
    remote.app.getGPUFeatureStatus()['2d_canvas'] === 'enabled';

  let shouldPromptSlow =
    !supportsAcceleratedCanvas &&
    rendererType === 'canvas' &&
    rendererConfig === 'auto';

  // Similar to https://github.com/Microsoft/vscode/commit/84eb4778f18215d00608ccf8fb7649e6f2cd428a
  // However, we'll use a circular buffer to continuously measure performance over time.
  let frameTimeBuffer = new Array(FRAME_BUFFER_SIZE).fill(0);
  let frameTimeIndex = 0;
  let frameTimeSum = 0;
  let frameNumber = 0;
  // $FlowIgnore: using unofficial _core interface defined in https://github.com/Microsoft/vscode/blob/master/src/typings/vscode-xterm.d.ts#L682-L706
  const renderDebouncer = terminal._core.renderer._renderDebouncer;
  const originalRenderCallback = renderDebouncer._callback;

  const evaluateAverage = () => {
    const averageTime = frameTimeSum / frameTimeBuffer.length;
    track('nuclide-terminal.render-performance', {
      averageTime,
      supportsAcceleratedCanvas,
      type: rendererType,
    });
    if (shouldPromptSlow && averageTime > SLOW_CANVAS_RENDER_THRESHOLD) {
      shouldPromptSlow = false;
      const notification = atom.notifications.addWarning(
        `The terminal GPU-based rendering appears to be slow on your computer (average frame render time was ${averageTime.toFixed(
          2,
        )}ms), do you want to use the fallback non-GPU renderer?`,
        {
          dismissable: true,
          buttons: [
            {
              text: 'Yes',
              onDidClick: () => {
                notification.dismiss();
                featureConfig.set(RENDERER_TYPE_CONFIG, 'dom');
                atom.notifications.addSuccess(
                  'All new terminals launched will use the non-GPU renderer',
                );
              },
            },
            {text: 'No', onDidClick: () => notification.dismiss()},
            {
              text: "No, don't show again",
              onDidClick: () => {
                featureConfig.set(RENDERER_TYPE_CONFIG, 'canvas');
                notification.dismiss();
              },
            },
          ],
        },
      );
    }
  };

  renderDebouncer._callback = (start: number, end: number) => {
    frameNumber++;
    if (
      // Don't measure the initial frame, as it might be slow.
      frameNumber === 1 ||
      // Once we've measured INITIAL_FRAMES_TO_MEASURE, sample at FRAME_SAMPLE_RATE.
      (frameNumber > INITIAL_FRAMES_TO_MEASURE + 1 &&
        frameNumber % FRAME_SAMPLE_RATE !== 0)
    ) {
      // Note: RendererDebouncer's callback must be prebound.
      originalRenderCallback(start, end);
      return;
    }
    const startTime = performanceNow();
    originalRenderCallback(start, end);
    process.nextTick(() => {
      const frameTime = performanceNow() - startTime;
      frameTimeSum += frameTime - frameTimeBuffer[frameTimeIndex];
      frameTimeBuffer[frameTimeIndex] = frameTime;
      frameTimeIndex++;
      if (frameTimeIndex === FRAME_BUFFER_SIZE) {
        frameTimeIndex = 0;
        // Note: We could evaluate more frequently, if we wanted to.
        evaluateAverage();
      }
    });
  };
  return new UniversalDisposable(() => {
    // Restore the original function.
    renderDebouncer._callback = originalRenderCallback;
    // Clear frame times because it won't be used again.
    frameTimeBuffer = [];
  });
}
