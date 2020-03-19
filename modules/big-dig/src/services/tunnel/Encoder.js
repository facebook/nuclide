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

const BUFFER_KEY = '_b';

const Encoder = {
  encode(obj: Object): string {
    const copy = {...obj};
    Encoder._replaceBuffersWithBase64(copy);
    return JSON.stringify(copy);
  },

  decode(str: string): Object {
    const result = JSON.parse(str);
    Encoder._replaceBase64WithBuffers(result);
    return result;
  },

  _replaceBuffersWithBase64(obj: Object) {
    Object.entries(obj).forEach(([key, value]) => {
      if (value instanceof Buffer) {
        const bufObj = {};
        bufObj[BUFFER_KEY] = value.toString('base64');
        obj[key] = bufObj;
      } else if (value != null && typeof value === 'object') {
        obj[key] = {...obj[key]};
        Encoder._replaceBuffersWithBase64(obj[key]);
      }
    });
  },

  _replaceBase64WithBuffers(obj: Object) {
    Object.entries(obj).forEach(([key, value]) => {
      if (value != null && typeof value === 'object') {
        if (typeof value[BUFFER_KEY] === 'string') {
          obj[key] = Buffer.from(value[BUFFER_KEY], 'base64');
        } else {
          obj[key] = {...obj[key]};
          Encoder._replaceBase64WithBuffers(obj[key]);
        }
      }
    });
  },
};

export default Encoder;
