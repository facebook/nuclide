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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Task} from '../../commons-node/tasks';
import type {TaskMetadata} from '../../nuclide-task-runner/lib/types';

import createExampleObservableTask from './createExampleObservableTask';
import ExampleEmitterTask from './ExampleEmitterTask';
import ExtraUi from './ExtraUi';
import Icon from './Icon';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class TaskRunner {
  id = 'my-awesome-task-runner';
  name = 'Awesome Stuff';

  getExtraUi(): React$ComponentType<any> {
    return ExtraUi;
  }

  getIcon(): React$ComponentType<any> {
    return Icon;
  }

  setProjectRoot(
    projectRoot: ?NuclideUri,
    callback: (enabled: boolean, taskList: Array<TaskMetadata>) => mixed,
  ): IDisposable {
    // Invoke the callback whenever the tasks change. For the purpose of the example, we'll assume
    // they never do and just invoke it once now.
    callback(true, [
      {
        type: 'build',
        label: 'Build',
        description: 'Build something cool',
        icon: 'tools',
      },
      {
        type: 'run',
        label: 'Run',
        description: 'Run it',
        icon: 'triangle-right',
      },
    ]);

    // The returned disposable should clean up any resources being used to determine when the tasks
    // change.
    return new UniversalDisposable();
  }

  runTask(taskType: string): Task {
    // You can create a task however you want as long as it conforms to the Task API. However,
    // because tasks have event registration methods, you'll probably either want to either use Rx
    // or extend event-kit's Emitter. An example of each is provided; both do the same thing.
    // Neither implements the full functionality so check out the Task definition for more detail.
    switch (taskType) {
      case 'build':
        return createExampleObservableTask();
      case 'run':
        return new ExampleEmitterTask();
      default:
        throw new Error(`Invalid task type: ${taskType}`);
    }
  }
}
