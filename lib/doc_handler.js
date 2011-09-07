var EventEmitter = require('events').EventEmitter
  , util         = require('util')

var DocHandler = function(queue) {
  queue
};

util.inherits(DocHandler, EventEmitter);

module.exports = DocHandler;