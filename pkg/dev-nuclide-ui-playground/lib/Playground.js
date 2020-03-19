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

import classnames from 'classnames';
import * as React from 'react';

import {Button} from 'nuclide-commons-ui/Button';
import {ButtonExamples} from 'nuclide-commons-ui/Button.example';
import {ProgressIndicatorExamples} from 'nuclide-commons-ui/ProgressIndicators.example';
import {CheckboxExamples} from 'nuclide-commons-ui/Checkbox.example';
import {ModalExamples} from 'nuclide-commons-ui/showModal.example';
import {DropdownExamples} from 'nuclide-commons-ui/Dropdown.example';
import {FullWidthProgressBarExamples} from 'nuclide-commons-ui/FullWidthProgressBar.example';
import {TabbableContainerExamples} from 'nuclide-commons-ui/TabbableContainer.example';
import {TabExamples} from 'nuclide-commons-ui/Tabs.example';
import {RadioGroupExamples} from 'nuclide-commons-ui/RadioGroup.example';
import {TextInputExamples} from 'nuclide-commons-ui/TextInputs.example';
import {ToolbarExamples} from 'nuclide-commons-ui/Toolbar.example';
import {BadgeExamples} from '../../nuclide-ui/Badge.example';
import {HighlightExamples} from 'nuclide-commons-ui/Highlight.example';
import {IconExamples} from 'nuclide-commons-ui/Icon.example';
import {TreeExamples} from 'nuclide-commons-ui/Tree.example';
import {ListviewExamples} from 'nuclide-commons-ui/ListView.example';
import {TableExamples} from 'nuclide-commons-ui/Table.example';
import {RelativeDateExamples} from '../../nuclide-ui/RelativeDate.example';
import {MultiRootChangedFilesViewExample} from '../../nuclide-ui/MultiRootChangedFilesView.example';
import {ToggleExamples} from '../../nuclide-ui/Toggle.example';
import {ResizableFlexContainerExamples} from '../../nuclide-ui/ResizableFlexContainer.example';
import {MessageExamples} from 'nuclide-commons-ui/Message.example';
import {PathWithFileIconExamples} from 'nuclide-commons-ui/PathWithFileIcon.example';
import {AnimatedEllipsisExamples} from '../../nuclide-ui/AnimatedEllipsis.example';
import {ComboboxExamples} from '../../nuclide-ui/Combobox.example';
import RegExpFilterExamples from 'nuclide-commons-ui/RegExpFilter.example';
import {FileChangesExamples} from 'nuclide-commons-ui/FileChanges.example';
import {HighlightedCodeExamples} from 'nuclide-commons-ui/HighlightedCode.example';
import {PulseButtonExample} from 'nuclide-commons-ui/PulseButton.example';
import {DateSelectorExamples} from 'nuclide-commons-ui/DateSelector.example';
import {WORKSPACE_VIEW_URI} from './constants';

const playgroundComponents = [
  ButtonExamples,
  DropdownExamples,
  ModalExamples,
  ProgressIndicatorExamples,
  FullWidthProgressBarExamples,
  CheckboxExamples,
  ToggleExamples,
  TabExamples,
  ResizableFlexContainerExamples,
  RadioGroupExamples,
  TextInputExamples,
  TabbableContainerExamples,
  RegExpFilterExamples,
  ToolbarExamples,
  BadgeExamples,
  HighlightExamples,
  IconExamples,
  TreeExamples,
  ListviewExamples,
  TableExamples,
  RelativeDateExamples,
  MessageExamples,
  MultiRootChangedFilesViewExample,
  PulseButtonExample,
  PathWithFileIconExamples,
  AnimatedEllipsisExamples,
  ComboboxExamples,
  FileChangesExamples,
  HighlightedCodeExamples,
  DateSelectorExamples,
];

type ComponentSpec = {
  sectionName: string,
  description: string,
  examples: Array<{
    title: string,
    component: React.ComponentType<any> | (() => React.Element<any>),
  }>,
};

type State = {
  collapsedSections: Set<string>,
};

export class Playground extends React.Component<any, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      collapsedSections: new Set(),
    };
  }

  getTitle(): string {
    return 'Nuclide UI Playground';
  }

  getIconName(): string {
    return 'puzzle';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'center';
  }

  serialize(): mixed {
    return {
      deserializer: 'nuclide.SampleUiPlayground',
    };
  }

  _collapseAllSections = (): void => {
    this.setState({
      collapsedSections: new Set(
        playgroundComponents.map(spec => spec.sectionName),
      ),
    });
  };

  _toggleSection(sectionName: string): void {
    const {collapsedSections} = this.state;
    if (collapsedSections.has(sectionName)) {
      collapsedSections.delete(sectionName);
    } else {
      collapsedSections.add(sectionName);
    }
    this.forceUpdate();
  }

  renderExampleForComponent = (
    spec: ComponentSpec,
    index: number,
  ): React.Element<any> => {
    const {sectionName, description, examples} = spec;
    let renderedDescription;
    let flattenedExample;
    const isCollapsed = this.state.collapsedSections.has(sectionName);
    if (!isCollapsed) {
      flattenedExample = [].concat(
        ...examples.map((example, i) => {
          const {title, component: Component} = example;
          return [
            <h2 key={`${index}:${i}t`}>{title}</h2>,
            <div
              key={`${index}:${i}c`}
              className="nuclide-ui-playground-example">
              <Component />
            </div>,
          ];
        }),
      );
      renderedDescription = <p>{description}</p>;
    }
    const h1ClassName = classnames({
      'nuclide-ui-playground-section-headline-collapsed': isCollapsed,
    });
    return (
      <section className="nuclide-ui-playground-section bordered" key={index}>
        <h1
          className={h1ClassName}
          onClick={this._toggleSection.bind(this, sectionName)}>
          {sectionName}
        </h1>
        {renderedDescription}
        {flattenedExample}
      </section>
    );
  };

  render(): React.Node {
    const renderedExamples = playgroundComponents.map(
      this.renderExampleForComponent,
    );
    return (
      <div className="nuclide-ui-playground">
        <div className="nuclide-ui-playground-header">
          <Button onClick={this._collapseAllSections}>
            Collapse all sections
          </Button>
        </div>
        {renderedExamples}
      </div>
    );
  }
}
