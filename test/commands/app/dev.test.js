/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const TheCommand = require('../../../src/commands/app/dev')
const BaseCommand = require('../../../src/BaseCommand')
const dataMocks = require('../../data-mocks/config-loader')
const cloneDeep = require('lodash.clonedeep')
const open = require('open')
const { ux } = require('@oclif/core')

jest.mock('@oclif/core', () => {
  return {
    ...jest.requireActual('@oclif/core'),
    ux: {
      action: {
        start: jest.fn(),
        stop: jest.fn()
      },
      wait: jest.fn()
    }
  }
})

jest.mock('open', () => jest.fn())
const mockRunDev = require('../../../src/lib/run-dev')

jest.mock('../../../src/lib/app-helper.js')
const helpers = require('../../../src/lib/app-helper.js')

const mockConfigData = {
  app: {
    hasFrontend: true,
    hasBackend: true
  }
}

// should be same as in run.js
const DEV_KEYS_DIR = 'dist/dev-keys/'
const PRIVATE_KEY_PATH = DEV_KEYS_DIR + 'private.key'
const PUB_CERT_PATH = DEV_KEYS_DIR + 'cert-pub.crt'
const CONFIG_KEY = 'aio-dev.dev-keys'

// mocks
const mockFS = require('fs-extra')
jest.mock('fs-extra')

jest.mock('@adobe/aio-lib-core-config')
const mockConfig = require('@adobe/aio-lib-core-config')

jest.mock('https')
const https = require('https')

jest.mock('get-port')
const getPort = require('get-port')

let command

const mockFindCommandRun = jest.fn()
const mockFindCommandLoad = jest.fn().mockReturnValue({
  run: mockFindCommandRun
})

const mockHttpsServerInstance = {
  listen: jest.fn(),
  close: jest.fn(),
  args: null
}

const createAppConfig = (aioConfig = {}, appFixtureName = 'legacy-app') => {
  const appConfig = dataMocks(appFixtureName, aioConfig).all
  appConfig.application = { ...appConfig.application, ...aioConfig }
  return appConfig
}

beforeEach(() => {
  jest.clearAllMocks()
  // mockRunDev.mockReset()

  mockConfig.get = jest.fn().mockReturnValue({ globalConfig: 'seems-legit' })

  mockFS.exists.mockReset()
  mockFS.existsSync.mockReset()
  mockFS.writeFile.mockReset()
  mockFS.readFile.mockReset()
  mockFS.ensureDir.mockReset()

  ux.action = {
    stop: jest.fn(),
    start: jest.fn()
  }
  open.mockReset()
  ux.wait = jest.fn() // .mockImplementation((ms = 1000) => { return new Promise(resolve => setTimeout(resolve, ms)) })

  mockFindCommandLoad.mockClear()
  mockFindCommandRun.mockReset()

  command = new TheCommand()
  command.error = jest.fn()
  command.log = jest.fn()
  command.config = {
    runHook: jest.fn(),
    findCommand: jest.fn().mockReturnValue({
      load: mockFindCommandLoad
    }),
    dataDir: '/data/dir'
  }
  command.appConfig = cloneDeep(mockConfigData)
  command.getAppExtConfigs = jest.fn()

  https.createServer.mockImplementation((opts, func) => {
    mockHttpsServerInstance.args = { opts, func }
    return mockHttpsServerInstance
  })
  mockHttpsServerInstance.listen.mockReset()
  mockHttpsServerInstance.close.mockReset()
  https.createServer.mockClear()

  getPort.mockReset()

  delete process.env.PORT
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('run command definition', () => {
  test('exports', async () => {
    expect(typeof TheCommand).toEqual('function')
    expect(TheCommand.prototype instanceof BaseCommand).toBeTruthy()
  })

  test('description', async () => {
    expect(TheCommand.description).toBeDefined()
  })

  test('aliases', async () => {
    expect(TheCommand.aliases).toEqual([])
  })

  test('flags', async () => {
    expect(typeof TheCommand.flags.open).toBe('object')
    expect(typeof TheCommand.flags.open.description).toBe('string')
    expect(TheCommand.flags.open.default).toEqual(false)

    expect(typeof TheCommand.flags.extension).toBe('object')
    expect(typeof TheCommand.flags.extension.description).toBe('string')
    expect(TheCommand.flags.extension.multiple).toEqual(false)
    expect(TheCommand.flags.extension.char).toEqual('e')
  })
})

/** @private */
function mockFSExists (files) {
  if (!Array.isArray(files)) { files = [files] }
  mockFS.exists.mockImplementation(async f => {
    if (files.includes(f)) {
      return true
    }
    return false
  })
  mockFS.existsSync.mockImplementation(f => {
    if (files.includes(f)) {
      return true
    }
    return false
  })
  mockFS.lstatSync.mockImplementation((f) => {
    return {
      isFile: () => true
    }
  })
}

describe('dev', () => {

  test('app:dev with manifest and no certificates', async () => {
    mockFSExists([PRIVATE_KEY_PATH, PUB_CERT_PATH])
    command.argv = []
    command.getAppExtConfigs.mockReturnValueOnce(createAppConfig(command.appConfig))

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRunDev).toHaveBeenCalledTimes(1)
  })
})
