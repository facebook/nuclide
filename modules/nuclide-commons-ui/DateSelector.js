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

/* global Node */

import classnames from 'classnames';
import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import {DateRangePicker} from 'tiny-date-picker/dist/date-range-picker';

type Props = {|
  // Selected start date
  start: ?Date,
  // Selected end date, ignored if selectRange is false
  end?: ?Date,
  // Earliest date that can be selected
  earliestDate?: Date,
  // Latest date that can be selected
  latestDate?: Date,
  // Only display calendar when in focus
  showOnlyOnFocus?: boolean,
  defaultOpen?: boolean,
  // Allow user to select a range of dates
  selectRange?: boolean,
  onDatesChange: (start: ?Date, end: ?Date) => void,
  children?: React.Node,
  className?: string,
|};

type State = {|
  isOpen: boolean,
|};

export class DateSelector extends React.Component<Props, State> {
  _refEl: React.ElementRef<any>;
  _datePicker: any;
  _disposable: ?IDisposable;

  constructor(props: Props) {
    super(props);
    this.state = {isOpen: Boolean(props.defaultOpen) || !props.showOnlyOnFocus};
    this._refEl = React.createRef();
  }

  componentDidMount() {
    if (Boolean(this.props.showOnlyOnFocus)) {
      this._disposable = new UniversalDisposable(
        Observable.fromEvent(window, 'mousedown').subscribe(
          this._handleWindowClick,
        ),
      );
    }
    this._createDatePicker();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!this.state.isOpen) {
      return;
    }
    const {start, end} = this.props;
    if (!this._checkDatesAreEqual(start, prevProps.start)) {
      this._createDatePicker(start);
    } else if (!this._checkDatesAreEqual(end, prevProps.end)) {
      this._createDatePicker(end);
    } else if (!this._datePicker) {
      this._createDatePicker();
    }
  }

  componentWillUnmount() {
    if (this._disposable) {
      this._disposable.dispose();
    }
  }

  _openDatePicker = (): void => {
    this.setState({isOpen: true});
  };

  _closeDatePicker = (): void => {
    this.setState({isOpen: false});
    this._datePicker = null;
  };

  _handleWindowClick = (e: SyntheticMouseEvent<>): void => {
    if (!(e.target instanceof Node)) {
      return;
    }
    if (this._refEl.current && !this._refEl.current.contains(e.target)) {
      this._closeDatePicker();
    }
  };

  _handleLostFocus = (e: SyntheticFocusEvent<>) => {
    if (!Boolean(this.props.showOnlyOnFocus)) {
      return;
    }

    const {target, relatedTarget} = e;
    if (
      !(
        target instanceof Node &&
        (relatedTarget instanceof Node || relatedTarget == null)
      )
    ) {
      return;
    }
    if (
      this._refEl.current &&
      !this._refEl.current.contains(target) &&
      !this._refEl.current.contains(relatedTarget)
    ) {
      this._closeDatePicker();
    }
  };

  _checkDatesAreEqual = (date1: ?Date, date2: ?Date) => {
    const time1 = date1 ? date1.getTime() : null;
    const time2 = date2 ? date2.getTime() : null;
    return time1 === time2;
  };

  _createDatePicker = (hilightedDate: ?Date): void => {
    if (!this._refEl.current) {
      return;
    }

    let {start, end} = this.props;
    const {earliestDate, latestDate} = this.props;
    // DateRangePicker can never have end without start
    if (start == null) {
      start = end;
      end = null;
    }

    this._datePicker = DateRangePicker(this._refEl.current, {
      startOpts: {
        hilightedDate: hilightedDate || start || new Date(),
        min: earliestDate,
        max: latestDate,
        shouldFocusOnRender: false,
        dayOffset: 1,
      },
    }).on('statechange', (_, dp) => {
      const newStart = dp.state.start;
      const newEnd = dp.state.end;
      if (!Boolean(this.props.selectRange)) {
        if (!this._checkDatesAreEqual(newStart, newEnd)) {
          dp.setState({start: newStart, end: newStart});
          return;
        }
      }

      // Call onDatesChange if new date was selected
      const prevEnd = Boolean(this.props.selectRange)
        ? this.props.end
        : this.props.start;
      if (
        !this._checkDatesAreEqual(this.props.start, newStart) ||
        (Boolean(this.props.selectRange) &&
          !this._checkDatesAreEqual(this.props.end, newEnd))
      ) {
        if (newEnd < newStart) {
          this.props.onDatesChange(newEnd, newStart);
        } else {
          this.props.onDatesChange(newStart, newEnd);
        }
      }

      if (
        Boolean(this.props.showOnlyOnFocus) &&
        newEnd != null &&
        !this._checkDatesAreEqual(newEnd, prevEnd)
      ) {
        this._closeDatePicker();
      }
    });

    this._datePicker.setState({start, end});
  };

  render(): React.Node {
    const classname = classnames(
      this.props.className,
      'nuclide-ui-date-selector',
      {'nuclide-ui-dropdown-date-selector': this.props.showOnlyOnFocus},
    );

    return (
      <div onFocus={this._openDatePicker} onBlur={this._handleLostFocus}>
        {this.props.children}
        {this.state.isOpen ? (
          <div className={classname} ref={this._refEl} />
        ) : null}
      </div>
    );
  }
}
