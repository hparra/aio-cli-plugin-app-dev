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
const { createWatcher, getActionNameFromPath } = require('../../src/lib/actions-watcher')
const chokidar = require('chokidar')
const mockLogger = require('@adobe/aio-lib-core-logging')
const util = require('node:util')
const { buildActions } = require('@adobe/aio-lib-runtime')
const sleep = util.promisify(setTimeout)

jest.mock('chokidar')
jest.mock('@adobe/aio-lib-runtime')

beforeEach(() => {
  jest.useFakeTimers()

  chokidar.watch.mockReset()
  mockLogger.mockReset()
  buildActions.mockReset()
})

test('exports', () => {
  expect(typeof createWatcher).toEqual('function')
  expect(typeof getActionNameFromPath).toEqual('function')
})

test('run and cleanup', async () => {
  let onChangeHandler = null

  const mockWatcherInstance = {
    on: jest.fn((event, handler) => {
      if (event === 'change') {
        onChangeHandler = handler
      }
    }),
    close: jest.fn()
  }
  chokidar.watch.mockImplementation(() => mockWatcherInstance)

  const config = {
    actions: {
      src: 'actions'
    }
  }
  const { watcher, watcherCleanup } = await createWatcher({ config })
  expect(typeof watcher).toEqual('object')
  expect(typeof watcherCleanup).toEqual('function')

  watcherCleanup()

  expect(mockWatcherInstance.on).toHaveBeenCalledWith('change', onChangeHandler)
  expect(chokidar.watch).toHaveBeenCalledWith(config.actions.src)
  expect(mockWatcherInstance.close).toHaveBeenCalled()
})

test('onChange handler', async () => {
  let onChangeHandler = null
  const mockWatcherInstance = {
    on: jest.fn((event, handler) => {
      if (event === 'change') {
        onChangeHandler = handler
      }
    }),
    close: jest.fn()
  }
  chokidar.watch.mockImplementation(() => mockWatcherInstance)

  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionNameFromPath = () => ['an-action']

  await createWatcher({ config, actionNameFromPath })
  expect(typeof onChangeHandler).toEqual('function')

  // first onchange
  await onChangeHandler('actions')
  expect(buildActions).toHaveBeenCalledTimes(1)
})

test('onChange handler called multiple times', async () => {
  let onChangeHandler = null
  const mockWatcherInstance = {
    on: jest.fn((event, handler) => {
      if (event === 'change') {
        onChangeHandler = handler
      }
    }),
    close: jest.fn()
  }
  chokidar.watch.mockImplementation(() => mockWatcherInstance)

  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionNameFromPath = () => ['an-action']

  await createWatcher({ config, actionNameFromPath })
  expect(typeof onChangeHandler).toEqual('function')

  // first onchange
  buildActions.mockImplementation(async () => await sleep(2000))
  onChangeHandler('actions')
  buildActions.mockImplementation(async () => { throw new Error() })

  // second onchange
  onChangeHandler('actions')

  await jest.runAllTimers()

  expect(buildActions).toHaveBeenCalledTimes(1)
})

test('file changed', async () => {
  let onChangeHandler = null
  const mockWatcherInstance = {
    on: jest.fn((event, handler) => {
      if (event === 'change') {
        onChangeHandler = handler
      }
    }),
    close: jest.fn()
  }
  chokidar.watch.mockImplementation(() => mockWatcherInstance)

  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionNameFromPath = () => ['an-action']

  await createWatcher({ config, actionNameFromPath })
  expect(typeof onChangeHandler).toEqual('function')

  // first onchange
  buildActions.mockImplementation(async () => await sleep(2000))
  await onChangeHandler('actions')

  // second onchange
  buildActions.mockImplementation(async () => {})
  await onChangeHandler('actions')

  await jest.runAllTimers()

  expect(buildActions).toHaveBeenCalled()
  expect(mockLogger.debug).toHaveBeenCalledWith('Code changed. Triggering build.')
})

test('onChange handler calls buildActions with filterActions', async () => {
  let onChangeHandler = null
  const mockWatcherInstance = {
    on: jest.fn((event, handler) => {
      if (event === 'change') {
        onChangeHandler = handler
      }
    }),
    close: jest.fn()
  }
  chokidar.watch.mockImplementation(() => mockWatcherInstance)

  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionList = ['an-action']
  const actionNameFromPath = () => actionList

  await createWatcher({ config, actionNameFromPath })
  expect(typeof onChangeHandler).toEqual('function')

  const filePath = process.platform === 'win32' ? '\\myactions\\action.js' : '/myactions/action.js'

  buildActions.mockImplementation(async () => await sleep(5000))
  onChangeHandler(filePath)

  await jest.runAllTimers()

  expect(buildActions).toHaveBeenCalledWith(
    config, actionList, false /* skipCheck */, /* emptyDist */ false
  )
})

test('on non-action file changed', async () => {
  let onChangeHandler = null
  const mockWatcherInstance = {
    on: jest.fn((event, handler) => {
      if (event === 'change') {
        onChangeHandler = handler
      }
    }),
    close: jest.fn()
  }
  chokidar.watch.mockImplementation(() => mockWatcherInstance)

  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionList = []
  const actionNameFromPath = () => actionList

  await createWatcher({ config, actionNameFromPath })
  expect(typeof onChangeHandler).toEqual('function')

  const filePath = process.platform === 'win32' ? '\\myactions\\action.js' : '/myactions/action.js'

  buildActions.mockImplementation(async () => await sleep(5000))
  onChangeHandler(filePath)

  await jest.runAllTimers()

  expect(buildActions).not.toHaveBeenCalled()
  expect(mockLogger.debug).toHaveBeenCalledWith('A non-action file was changed, no build was done.')
})

test('onChange handler calls buildActions but there is an exception', async () => {
  const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation()

  let onChangeHandler = null
  const mockWatcherInstance = {
    on: jest.fn((event, handler) => {
      if (event === 'change') {
        onChangeHandler = handler
      }
    }),
    close: jest.fn()
  }
  chokidar.watch.mockImplementation(() => mockWatcherInstance)

  const config = {
    actions: {
      src: 'actions'
    }
  }
  const actionList = ['an-action']
  const actionNameFromPath = () => actionList

  await createWatcher({ config, actionNameFromPath })
  expect(typeof onChangeHandler).toEqual('function')

  const filePath = process.platform === 'win32' ? '\\myactions\\action.js' : '/myactions/action.js'

  buildActions.mockRejectedValue('an error')
  onChangeHandler(filePath)

  await jest.runAllTimers()

  expect(buildActions).toHaveBeenCalledTimes(1)
  expect(consoleErrorMock).toHaveBeenCalledWith('an error')
  consoleErrorMock.mockRestore()
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
    const config = {
      manifest: {
        full: {
          packages: {
            myPackage: {
              actions: {
                myAction: {
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
    expect(actionNames[0]).toEqual('myAction')
  })
})
