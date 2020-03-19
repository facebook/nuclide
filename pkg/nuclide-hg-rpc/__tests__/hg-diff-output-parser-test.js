/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {
  parseHgDiffUnifiedOutput,
  parseMultiFileHgDiffUnifiedOutput,
} from '../lib/hg-diff-output-parser';

const MULTI_CHUNK_CHANGE_HG_DIFF_OUTPUT = `diff --git a/test-test/blah/blah.js b/test-test/blah/blah.js
--- a/jar-rename/blah/blah.js
+++ b/jar-rename/blah/blah.js
@@ -1,0 +2,2 @@
+
+asdfdf
diff --git a/test.xml b/test.xml
--- a/pom.xml
+++ b/pom.xml
@@ -152,0 +153,3 @@
+
+test
+test`;

const MULTI_CHUNK_ADD_MOVE_COPY_DELETE_CHANGES = `diff --git a/add.js b/add.js
--- /dev/null
+++ add.js
@@ -0,0 +1,1 @@
+add
diff --git a/delete.txt b/delete.txt
--- delete.txt
+++ /dev/null
@@ -1, +0,0 @@
-delete
diff --git a/copybefore.txt b/copyafter.txt
copy from copybefore.txt
copy to copyafter.txt
--- copybefore.txt
+++ copyafter.txt
@@ -1, +1 @@
-delete
+add
diff --git a/movebefore.txt b/moveafter.txt
rename from movebefore.txt
rename to moveafter.txt
--- renamebefore.txt
+++ renameafter.txt
@@ -1, +1 @@
-rename
+newline`;

const MULTI_FILE_HG_DIFF_OUTPUT = `diff --git test-test/blah/blah.js test-test/blah/blah.js
--- test-test/blah/blah.js
+++ test-test/blah/blah.js
@@ -90,0 +91,1 @@
+  parseMultiFileHgDiffUnifiedOutput,
diff --git test-test/foo/foo.js test-test/foo/foo.js
--- test-test/foo/foo.js
+++ test-test/foo/foo.js
@@ -12,1 +12,4 @@
-const {parseHgDiffUnifiedOutput} = require('../lib/hg-diff-output-parser');
+const {
+  parseHgDiffUnifiedOutput,
+  parseMultiFileHgDiffUnifiedOutput,
+} = require('../lib/hg-diff-output-parser');
@@ -28,0 +32,4 @@
+const MULTI_FILE_HG_DIFF_OUTPUT =
+'
+';
+
@@ -123,0 +131,4 @@
+
+  describe('parseMultiFileHgDiffUnifiedOutput', () => {
+
+  });`;

describe('hg-diff-output-parser', () => {
  describe('parseHgDiffUnifiedOutput', () => {
    it('parses a summary line correctly when both old and new line counts are explicit.', () => {
      const testOutput = '@@ -150,11 +150,2 @@';
      const diffInfo = parseHgDiffUnifiedOutput(testOutput);
      expect(diffInfo).toEqual({
        added: 2,
        deleted: 11,
        lineDiffs: [
          {
            oldStart: 150,
            oldLines: 11,
            newStart: 150,
            newLines: 2,
            oldText: '',
          },
        ],
      });
    });

    it('parses a summary line correctly when both old and new line counts are left out.', () => {
      const testOutput = '@@ -150 +150 @@';
      const diffInfo = parseHgDiffUnifiedOutput(testOutput);
      expect(diffInfo).toEqual({
        added: 1,
        deleted: 1,
        lineDiffs: [
          {
            oldStart: 150,
            oldLines: 1,
            newStart: 150,
            newLines: 1,
            oldText: '',
          },
        ],
      });
    });

    it('parses a summary line correctly when the old line count is left out.', () => {
      const testOutput = '@@ -150 +150,2 @@';
      const diffInfo = parseHgDiffUnifiedOutput(testOutput);
      expect(diffInfo).toEqual({
        added: 2,
        deleted: 1,
        lineDiffs: [
          {
            oldStart: 150,
            oldLines: 1,
            newStart: 150,
            newLines: 2,
            oldText: '',
          },
        ],
      });
    });

    it('parses a summary line correctly when the new line count is left out.', () => {
      const testOutput = '@@ -150,11 +150 @@';
      const diffInfo = parseHgDiffUnifiedOutput(testOutput);
      expect(diffInfo).toEqual({
        added: 1,
        deleted: 11,
        lineDiffs: [
          {
            oldStart: 150,
            oldLines: 11,
            newStart: 150,
            newLines: 1,
            oldText: '',
          },
        ],
      });
    });

    it('parses a full diff output correctly when multiple chunks changes.', () => {
      const diffInfo = parseHgDiffUnifiedOutput(
        MULTI_CHUNK_CHANGE_HG_DIFF_OUTPUT,
      );
      expect(diffInfo).toEqual({
        added: 5,
        deleted: 0,
        lineDiffs: [
          {
            oldStart: 1,
            oldLines: 0,
            newStart: 2,
            newLines: 2,
            oldText: '',
          },
          {
            oldStart: 152,
            oldLines: 0,
            newStart: 153,
            newLines: 3,
            oldText: '',
          },
        ],
      });
    });

    it('handles empty string as input.', () => {
      const diffInfoForNull = parseHgDiffUnifiedOutput('');
      const diffInfoForEmptyString = parseHgDiffUnifiedOutput('');
      expect(diffInfoForNull).toEqual({
        added: 0,
        deleted: 0,
        lineDiffs: [],
      });
      expect(diffInfoForEmptyString).toEqual(diffInfoForNull);
    });
  });

  describe('parseMultiFileHgDiffUnifiedOutput', () => {
    it('parses the diff information correctly for each file.', () => {
      const diffInfoForManyFiles = parseMultiFileHgDiffUnifiedOutput(
        MULTI_FILE_HG_DIFF_OUTPUT,
      );
      expect(diffInfoForManyFiles.size).toBe(2);
      expect(diffInfoForManyFiles.get('test-test/blah/blah.js')).toEqual({
        added: 1,
        deleted: 0,
        lineDiffs: [
          {
            oldStart: 90,
            oldLines: 0,
            newStart: 91,
            newLines: 1,
            oldText: '',
          },
        ],
      });
      expect(diffInfoForManyFiles.get('test-test/foo/foo.js')).toEqual({
        added: 12,
        deleted: 1,
        lineDiffs: [
          {
            oldStart: 12,
            oldLines: 1,
            newStart: 12,
            newLines: 4,
            oldText:
              "const {parseHgDiffUnifiedOutput} = require('../lib/hg-diff-output-parser');\n",
          },
          {
            oldStart: 28,
            oldLines: 0,
            newStart: 32,
            newLines: 4,
            oldText: '',
          },
          {
            oldStart: 123,
            oldLines: 0,
            newStart: 131,
            newLines: 4,
            oldText: '',
          },
        ],
      });
    });

    describe('parseMultiFileHgDiffUnifiedOutput', () => {
      it('parses the diff information correctly for each file.', () => {
        const diffInfoForManyFiles = parseMultiFileHgDiffUnifiedOutput(
          MULTI_CHUNK_ADD_MOVE_COPY_DELETE_CHANGES,
        );
        expect(diffInfoForManyFiles.size).toBe(4);
        expect(diffInfoForManyFiles.get('add.js')).toEqual({
          added: 1,
          deleted: 0,
          lineDiffs: [
            {
              oldStart: 0,
              oldLines: 0,
              newStart: 1,
              newLines: 1,
              oldText: '',
            },
          ],
        });
        expect(diffInfoForManyFiles.get('delete.txt')).toEqual({
          added: 0,
          deleted: 1,
          lineDiffs: [
            {
              oldStart: 1,
              oldLines: 1,
              newStart: 0,
              newLines: 0,
              oldText: 'delete\n',
            },
          ],
        });
        expect(diffInfoForManyFiles.get('copyafter.txt')).toEqual({
          added: 1,
          deleted: 1,
          lineDiffs: [
            {
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
              oldText: 'delete\n',
            },
          ],
        });
        expect(diffInfoForManyFiles.get('renameafter.txt')).toEqual({
          added: 1,
          deleted: 1,
          lineDiffs: [
            {
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
              oldText: 'rename\n',
            },
          ],
        });
      });
    });
  });
});
