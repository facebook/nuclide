"use babel"

import Blamer from 'blamer'
let blamer = null

export default async function (file, callback) {
  if (!blamer) {
    blamer = new Blamer('git')
  }

  const result = await blamer.blameByFile(file);

  return result[file];
}
