var inherits     = require('util').inherits
  , EventEmitter = require('events').EventEmitter;
  
var Database = function() {};

inherits(Database, EventEmitter);

Database.prototype.setUri = function(uri) {
  this.uri = uri;
};

Database.prototype.triggerChange = function(doc) {
  this.emit('change', doc);
};

module.exports = Database;