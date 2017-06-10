/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import React from 'react';
import {zeroPaddedHex} from './Unicode';

type DatatipComponentProps = {
  codePoints: Array<number>,
};

export default function makeUnescapedUnicodeDatatipComponent(
  codePoints: Array<number>,
): ReactClass<any> {
  return () => <UnescapedUnicodeDatatipComponent codePoints={codePoints} />;
}

const UnescapedUnicodeDatatipComponent = (props: DatatipComponentProps) => {
  const text = props.codePoints.map(cp => String.fromCodePoint(cp)).join('');
  const charsWithCodePoints = props.codePoints.map((cp, i) => {
    const hex = zeroPaddedHex(cp, 4);
    return (
      <div
        className="nuclide-unicode-escapes-unescaped-char"
        key={i}
        title={'U+' + hex}>
        {String.fromCodePoint(cp)}
        <div className="nuclide-unicode-escapes-unescaped-char-code-point">
          {hex}
        </div>
      </div>
    );
  });
  const result = (
    <table className="nuclide-unicode-escapes-unescaped-datatip">
      <tr>
        <td>Visual</td>
        <td className="nuclide-unicode-escapes-string">
          {text}
        </td>
      </tr>
      <tr>
        <td>Logical</td>
        <td>
          <div className="nuclide-unicode-escapes-string">
            {charsWithCodePoints}
          </div>
        </td>
      </tr>
    </table>
  );
  return result;
};
