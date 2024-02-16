
const path = require('path')
const mime = require('mime')

// const config = require('./script.config')

module.exports = async (req, res, next) => {
  const url = req.params[0]
  const parts = url.split('/')
  const actionName = parts[0]
  const requestPath = url.replace(actionName, '')

  const params = {
    __ow_body: req.body,
    __ow_headers: req.headers,
    __ow_path: requestPath,
    __ow_query: req.query,
    __ow_method: req.method.toLowerCase(),
    ...req.query,
    ...(req.is('application/json') ? req.body : {})
  }
  params.__ow_headers['x-forwarded-for'] = '127.0.0.1'

  // disallow access to UI action -> avoids getting wrong path pointing to
  // remote action folder. This is a tmp fix which will be solved once html is
  // not served by action for remote
  const action = config.wskManifestActions[actionName]
  if (!action) {
    return res.status(404)
      .send({ error: '404: Action ' + actionName + ' not found' })
  }

  const actionPath = action.function
  const actionFunction = require(path.join(config.rootDir, actionPath)).main

  try {
    const response = await actionFunction(params)
    const headers = response.headers
    const status = response.statusCode

    headers['Content-Type'] = headers['Content-Type'] || headers['content-type'] || mime.getType(requestPath)
    return res
      .set(headers || {})
      .status(status || 200)
      .send(response.body)
  } catch (e) {
    return res
      .status(500)
      .send({ error: e.message })
  }
}
