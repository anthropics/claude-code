/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 */

var debug = require('debug')('body-parser:text')
var isFinished = require('on-finished').isFinished
var read = require('../read')
var typeis = require('type-is')
var { getCharset, normalizeOptions } = require('../utils')

/**
 * Module exports.
 */

module.exports = text

/**
 * Create a middleware to parse text bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function text (options) {
  var { inflate, limit, verify, shouldParse } = normalizeOptions(options, 'text/plain')

  var defaultCharset = options?.defaultCharset || 'utf-8'

  function parse (buf) {
    return buf
  }

  return function textParser (req, res, next) {
    if (isFinished(req)) {
      debug('body already parsed')
      next()
      return
    }

    if (!('body' in req)) {
      req.body = undefined
    }

    // skip requests without bodies
    if (!typeis.hasBody(req)) {
      debug('skip empty body')
      next()
      return
    }

    debug('content-type %j', req.headers['content-type'])

    // determine if request should be parsed
    if (!shouldParse(req)) {
      debug('skip parsing')
      next()
      return
    }

    // get charset
    var charset = getCharset(req) || defaultCharset

    // read
    read(req, res, next, parse, debug, {
      encoding: charset,
      inflate,
      limit,
      verify
    })
  }
}
