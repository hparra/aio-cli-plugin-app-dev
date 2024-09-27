/*
Copyright 2024 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const { createWatcher, getActionNameFromPath, Queue } = require('../../src/lib/actions-watcher')
const chokidar = require('chokidar')
const mockLogger = require('@adobe/aio-lib-core-logging')
const util = require('node:util')
const { buildActions } = require('@adobe/aio-lib-runtime')
const sleep = util.promisify(setTimeout)

jest.mock('chokidar')
jest.mock('@adobe/aio-lib-runtime')

const mockWatcherInstance = {
  on: jest.fn(),
  close: jest.fn()
}

beforeEach(() => {
  chokidar.watch.mockReset()
  mockLogger.mockReset()
  buildActions.mockReset()

  chokidar.watch.mockImplementation(() => mockWatcherInstance)
})

test('exports', () => {
  expect(typeof createWatcher).toEqual('function')
  expect(typeof getActionNameFromPath).toEqual('function')
})

test('run and cleanup', async () => {
  const config = {
    actions: {
      src: 'actions'
    }
  }
  const { watcher, watcherCleanup, onChangeHandler } = await createWatcher({ config })
  expect(typeof watcher).toEqual('object')
  expect(typeof watcherCleanup).toEqual('function')
  expect(typeof onChangeHandler).toEqual('function')

  await watcherCleanup()

  expect(mockWatcherInstance.on).toHaveBeenCalledWith('change', onChangeHandler)
  expect(chokidar.watch).toHaveBeenCalledWith(config.actions.src)
  expect(mockWatcherInstance.close).toHaveBeenCalled()
})

test('non-action file changed', async () => {
  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionList = []
  const actionNameFromPath = () => actionList

  const { onChangeHandler } = await createWatcher({ config, actionNameFromPath })
  expect(typeof onChangeHandler).toEqual('function')

  const filePath = '/some/action.js'

  buildActions.mockImplementation(async () => {})
  await onChangeHandler(filePath)

  expect(buildActions).not.toHaveBeenCalled()
  expect(mockLogger.debug).toHaveBeenCalledWith('A non-action file was changed, no build was done.')
})

test('action file changed', async () => {
  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionName = 'an-action'
  const actionNameFromPath = () => [actionName]

  const { onChangeHandler } = await createWatcher({ config, actionNameFromPath })
  await onChangeHandler(actionName)

  expect(buildActions).toHaveBeenCalledTimes(1)
})

test('action file changed - buildActions throws exception', async () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()

  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionList = ['an-action']
  const actionNameFromPath = () => actionList

  const { onChangeHandler } = await createWatcher({ config, actionNameFromPath })

  const filePath = '/some-action-path'

  buildActions.mockRejectedValue('an error')
  await onChangeHandler(filePath)

  expect(buildActions).toHaveBeenCalledTimes(1)
  expect(mockConsoleError).toHaveBeenCalledWith('an error')
  mockConsoleError.mockRestore()
})

test('enqueue item if build in progress', async () => {
  const config = {
    actions: {
      src: 'actions'
    }
  }

  const actionName = 'an-action'
  const actionNameFromPath = () => [actionName]

  const { onChangeHandler } = await createWatcher({ config, actionNameFromPath })

  // first onChange, will take some time
  buildActions.mockImplementation(async () => await sleep(2000))
  onChangeHandler(actionName)

  // second onChange, will enqueue
  buildActions.mockImplementation(async () => {})
  onChangeHandler(actionName)

  // wait for a bit, so second change will be processed after the first
  await sleep(2000)

  // both changes are processed
  expect(buildActions).toHaveBeenCalledTimes(2)
})

describe('getActionNameFromPath', () => {
  test('not found', async () => {
    const config = {
      manifest: {
        full: {
          packages: {
            myPackage: {
              actions: {
                a: {
                  function: 'some/path/index.js'
                }
              }
            }
          }
        }
      }
    }

    const actionNames = getActionNameFromPath('foo/bar/not/found.js', { config })
    expect(actionNames.length).toEqual(0)
  })

  test('no actions (coverage)', async () => {
    const config = {
      manifest: {
        full: {
          packages: {
            myPackage: {}
          }
        }
      }
    }

    const actionNames = getActionNameFromPath('some/path/index.js', { config })
    expect(actionNames.length).toEqual(0)
  })

  test('found', async () => {
    const actionPath = 'some/path/index.js'
    const actionName = 'myAction'
    const config = {
      manifest: {
        full: {
          packages: {
            myPackage: {
              actions: {
                [actionName]: {
                  function: actionPath
                }
              }
            }
          }
        }
      }
    }

    const actionNames = getActionNameFromPath(actionPath, { config })
    expect(actionNames.length).toEqual(1)
    expect(actionNames[0]).toEqual(actionName)
  })
})

describe('Queue', () => {
  let queue

  beforeEach(() => {
    queue = new Queue()
  })

  test('new', () => {
    expect(queue.length).toEqual(0)
  })

  test('enqueue', () => {
    queue.enqueue('a')
    queue.enqueue('b')

    expect(queue.length).toEqual(2)
    expect(queue.items).toEqual(['a', 'b'])
  })

  test('dequeue', () => {
    // intially, a dequeue will have nothing
    expect(queue.dequeue()).not.toBeDefined()

    queue.enqueue('a')
    queue.enqueue('b')

    // FIFO
    expect(queue.dequeue()).toEqual('a')
    expect(queue.dequeue()).toEqual('b')
    expect(queue.length).toEqual(0)
  })
})
