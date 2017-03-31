/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

 import React from 'react';
 import ReactDOM from 'react-dom';
 import UniversalDisposable from '../../commons-node/UniversalDisposable';
 import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
 class Activation {

   constructor() {
     this._subscriptions = new UniversalDisposable(
       atom.commands.add('atom-workspace', {
         'nuclide-create-react-native-app:init': () => {
         },
       }),
     );
   }

   dispose(): void {
     this._subscriptions.dispose();
   }
 }

 let activation: ?Activation = null;

 export function activate(): void {
   activation = new Activation();
 }

 export function deactivate(): void {
   activation.dispose();
   activation = null;
 }

 export function getHomeFragments(): HomeFragments {
   return {
     feature: {
       title: 'React Native',
       icon: 'nuclicon-react',
       description: 'Initializes an application in React Native using create-react-native-app',
       command: 'nuclide-create-react-native-app:init',
     },
     priority: 10,
   };
 }
