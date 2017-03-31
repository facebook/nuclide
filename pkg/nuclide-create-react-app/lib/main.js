/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

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
 import {BufferedNodeProcess} from 'atom';
 import { safeSpawn, runCommand, getOutputStream } from '../../commons-node/process';
 import {Observable} from 'rxjs';
 import fs from 'fs';
 import os from 'os';
 
 class Activation {

   constructor() {
     const dirName  = 'demo-react'
     this._subscriptions = new UniversalDisposable(
       atom.commands.add('atom-workspace', {
         'nuclide-create-react-app:init': () => {
           
          const command = '/usr/local/lib/node_modules/create-react-app/index.js'
          const args = [dirName]
          const options = {
            cwd: '/Users/' + os.userInfo().username + '/Documents'
          }
          const stdout = (output) => console.log(output)
          const stderr = (err) => console.log(err);
          const exit = (code) => console.log("ps -ef exited with #{code}")
          
          new BufferedNodeProcess({command, args, options, stdout, stderr, exit})
         }
       })
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
       title: 'React',
       icon: 'nuclicon-react',
       description: 'Initializes an application in React using create-react-app',
       command: 'nuclide-create-react-app:init',
     },
     priority: 10,
   };
 }