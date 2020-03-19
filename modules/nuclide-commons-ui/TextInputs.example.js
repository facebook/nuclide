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

import {TextBuffer} from 'atom';
import * as React from 'react';
import {Block} from './Block';
import {AtomInput} from './AtomInput';
import {AtomTextEditor} from './AtomTextEditor';

const AtomInputExample = (): React.Element<any> => (
  <div>
    <Block>
      <AtomInput
        disabled={false}
        initialValue="atom input"
        placeholderText="placeholder text"
      />
    </Block>
    <Block>
      <AtomInput
        disabled={true}
        initialValue="disabled atom input"
        placeholderText="placeholder text"
      />
    </Block>
    <Block>
      <AtomInput
        initialValue="xs atom input"
        placeholderText="placeholder text"
        size="xs"
      />
    </Block>
    <Block>
      <AtomInput
        initialValue="sm atom input"
        placeholderText="placeholder text"
        size="sm"
      />
    </Block>
    <Block>
      <AtomInput
        initialValue="lg atom input"
        placeholderText="placeholder text"
        size="lg"
      />
    </Block>
    <Block>
      <AtomInput
        initialValue="unstyled atom input"
        placeholderText="placeholder text"
        unstyled={true}
      />
    </Block>
    <Block>
      <AtomInput
        initialValue="atom input with custom width"
        placeholderText="placeholder text"
        width={200}
      />
    </Block>
  </div>
);

const buffer1 = new TextBuffer({
  text: '/**\n * Hi!\n */\n\n// I am a TextBuffer.\nconst a = 42;',
});
const buffer2 = new TextBuffer({
  text:
    '/**\n * Hi!\n */\n\n// I am a read-only, gutter-less TextBuffer.\nconst a = 42;',
});
const editorWrapperStyle = {
  display: 'flex',
  flexGrow: 1,
  height: '12em',
  boxShadow: '0 0 20px 0 rgba(0, 0, 0, 0.3)',
};

const AtomTextEditorExample = (): React.Element<any> => (
  <Block>
    <div style={editorWrapperStyle}>
      <AtomTextEditor
        gutterHidden={false}
        readOnly={false}
        syncTextContents={false}
        autoGrow={false}
        path="aJavaScriptFile.js"
        textBuffer={buffer1}
      />
    </div>
    <div style={{...editorWrapperStyle, marginTop: '2em'}}>
      <AtomTextEditor
        gutterHidden={true}
        readOnly={true}
        syncTextContents={false}
        autoGrow={false}
        path="aJavaScriptFile.js"
        textBuffer={buffer2}
      />
    </div>
  </Block>
);

export const TextInputExamples = {
  sectionName: 'Text Inputs',
  description: '',
  examples: [
    {
      title: 'AtomInput',
      component: AtomInputExample,
    },
    {
      title: 'AtomTextEditor',
      component: AtomTextEditorExample,
    },
  ],
};
