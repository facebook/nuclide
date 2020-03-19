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

import invariant from 'assert';
import * as React from 'react';
import {shell} from 'electron';
import createDOMPurify from 'dompurify';

const domPurify = createDOMPurify();

type DiagnosticsMessageTextProps = {
  preserveNewlines?: boolean, // defaults to true
  message: {
    html?: string,
    text?: string,
  },
};

type UrlOrText =
  | {
      isUrl: true,
      url: string,
    }
  | {
      isUrl: false,
      text: string,
    };

// Exported for testing.
export function separateUrls(message: string): Array<UrlOrText> {
  // Don't match periods at the end of URLs, because those are usually just to
  // end the sentence and not actually part of the URL. Optionally match
  // parameters following a question mark.

  // first bit before query/fragment
  const mainUrl = /https?:\/\/[\w/.%-]*[\w/-]/.source;
  // characters allowed in query/fragment, disallow `.` at the end
  const queryChars = /[\w-~%&+.!=:@/?]*[\w-~%&+!=:@/?]/.source;
  const urlRegex = new RegExp(
    `${mainUrl}(?:\\?${queryChars})?(?:#${queryChars})?`,
    'g',
  );

  const urls = message.match(urlRegex);
  const nonUrls = message.split(urlRegex);

  const parts: Array<UrlOrText> = [
    {
      isUrl: false,
      text: nonUrls[0],
    },
  ];
  for (let i = 1; i < nonUrls.length; i++) {
    invariant(urls != null);
    parts.push({
      isUrl: true,
      url: urls[i - 1],
    });
    parts.push({
      isUrl: false,
      text: nonUrls[i],
    });
  }
  return parts;
}

const LEADING_WHITESPACE_RE = /^\s+/;
const NBSP = '\xa0';
function renderRowWithLinks(
  message: string,
  rowIndex: number,
  rows: Array<string>,
): React.Element<any> {
  const messageWithWhitespace = message.replace(
    LEADING_WHITESPACE_RE,
    whitespace => NBSP.repeat(whitespace.length),
  );
  const parts = separateUrls(messageWithWhitespace).map((part, index) => {
    if (!part.isUrl) {
      return part.text;
    } else {
      const openUrl = () => {
        shell.openExternal(part.url);
      };
      return (
        <a href="#" key={index} onClick={openUrl}>
          {part.url}
        </a>
      );
    }
  });

  return (
    // We need to use a span here instead of a div so that `text-overflow: ellipsis` works.
    <span key={rowIndex}>
      {parts}
      {rowIndex !== rows.length - 1 && <br />}
    </span>
  );
}

export const DiagnosticsMessageText = (props: DiagnosticsMessageTextProps) => {
  const {message} = props;
  if (message.html != null) {
    return (
      <span
        title={message.text}
        dangerouslySetInnerHTML={{
          __html: domPurify.sanitize(message.html),
        }}
      />
    );
  } else if (message.text != null) {
    const rows =
      props.preserveNewlines !== false
        ? message.text.split('\n')
        : [message.text];
    return <span title={message.text}>{rows.map(renderRowWithLinks)}</span>;
  } else {
    return <span>Diagnostic lacks message.</span>;
  }
};
