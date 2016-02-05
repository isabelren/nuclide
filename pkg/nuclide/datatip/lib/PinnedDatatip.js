'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  Datatip,
} from '../../datatip-interfaces';

type Position = {
  x: number,
  y: number,
}

import {CompositeDisposable, Disposable} from 'atom';
import {
  React,
  ReactDOM,
} from 'react-for-atom';
import Rx from 'rx';
import invariant from 'assert';

import {DatatipComponent, DATATIP_ACTIONS} from './DatatipComponent';

const LINE_END_MARGIN = 20;

let _mouseMove$;
function documentMouseMove$(): Rx.Observable<MouseEvent> {
  if (_mouseMove$ == null) {
    _mouseMove$ = Rx.Observable.fromEvent(document, 'mousemove');
  }
  return _mouseMove$;
}

let _mouseUp$;
function documentMouseUp$(): Rx.Observable<MouseEvent> {
  if (_mouseUp$ == null) {
    _mouseUp$ = Rx.Observable.fromEvent(document, 'mouseup');
  }
  return _mouseUp$;
}

export class PinnedDatatip {
  _boundDispose: Function;
  _boundHandleMouseDown: Function;
  _hostElement: HTMLElement;
  _marker: ?atom$Marker;
  _mouseDisposable: ?IDisposable;
  _subscriptions: atom$CompositeDisposable;
  _marker: ?atom$Marker;
  _range: atom$Range;
  _component: ReactElement;
  _editor: TextEditor;
  _hostElement: HTMLElement;
  _boundDispose: Function;
  _dragOrigin: ?Position;
  _isDragging: boolean;
  _offset: Position;

  constructor(
    datatip: Datatip,
    editor: TextEditor,
    onDispose: (pinnedDatatip: PinnedDatatip) => void) {
    const {
      range,
      component,
    } = datatip;
    this._subscriptions = new CompositeDisposable();
    this._subscriptions.add(new Disposable(() => onDispose(this)));
    this._range = range;
    this._component = component;
    this._editor = editor;
    this._marker = null;
    this._hostElement = document.createElement('div');
    this._hostElement.className = 'nuclide-datatip-overlay';
    this._boundDispose = this.dispose.bind(this);

    this._offset = {x: 0, y: 0};
    this._isDragging = false;
    this._dragOrigin = null;

    this._boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.render();
  }

  handleGlobalMouseMove(event: Event): void {
    const evt: MouseEvent = (event: any);
    const {_dragOrigin} = this;
    invariant(_dragOrigin);
    this._offset = {
      x: evt.clientX - _dragOrigin.x,
      y: evt.clientY - _dragOrigin.y,
    };
    this.render();
  }

  handleGlobalMouseUp(): void {
    this._isDragging = false;
    this._dragOrigin = null;
    if (this._mouseDisposable != null) {
      this._mouseDisposable.dispose();
      this._mouseDisposable = null;
    }
    this.render();
  }

  handleMouseDown(event: Event): void {
    const evt: MouseEvent = (event: any);
    this._isDragging = true;
    this._dragOrigin = {
      x: evt.clientX - this._offset.x,
      y: evt.clientY - this._offset.y,
    };
    if (this._mouseDisposable != null) {
      this._mouseDisposable.dispose();
      this._mouseDisposable = null;
    }
    this._mouseDisposable =
      documentMouseMove$().takeUntil(documentMouseUp$()).subscribe(Rx.Observer.create(
      (e: MouseEvent) => {this.handleGlobalMouseMove(e);},
      (error: any) => {},
      () => {this.handleGlobalMouseUp();},
    ));
  }

  // Ensure positioning of the Datatip at the end of the current line.
  _updateHostElementPosition(): void {
    const {
      _editor,
      _range,
      _hostElement,
      _offset,
    } = this;
    const charWidth = _editor.getDefaultCharWidth();
    const lineLength = _editor.getBuffer().getLines()[_range.start.row].length;
    _hostElement.style.display = 'block';
    _hostElement.style.top = -_editor.getLineHeightInPixels() + _offset.y + 'px';
    _hostElement.style.left =
      (lineLength - _range.end.column) * charWidth + LINE_END_MARGIN + _offset.x + 'px';
  }

  render(): void {
    const {
      _editor,
      _range,
      _component,
      _hostElement,
      _isDragging,
    } = this;
    this._updateHostElementPosition();
    ReactDOM.render(
      <DatatipComponent
        action={DATATIP_ACTIONS.CLOSE}
        actionTitle="Close this datatip"
        className={_isDragging ? 'nuclide-datatip-dragging' : ''}
        onActionClick={this._boundDispose}
        onMouseDown={this._boundHandleMouseDown}>
        {_component}
      </DatatipComponent>,
      _hostElement,
    );

    if (this._marker == null) {
      const marker: atom$Marker = _editor.markBufferRange(_range, {invalidate: 'never'});
      this._marker = marker;
      _editor.decorateMarker(
        marker,
        {
          type: 'overlay',
          position: 'head',
          item: this._hostElement,
        }
      );
      _editor.decorateMarker(
        marker,
        {
          type: 'highlight',
          class: 'nuclide-datatip-highlight-region',
        }
      );
    }
  }

  dispose(): void {
    if (this._marker != null) {
      this._marker.destroy();
    }
    if (this._mouseDisposable != null) {
      this._mouseDisposable.dispose();
    }
    ReactDOM.unmountComponentAtNode(this._hostElement);
    this._hostElement.remove();
    this._subscriptions.dispose();
  }

}
