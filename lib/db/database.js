var inherits     = require('util').inherits
  , EventEmitter = require('events').EventEmitter;
  
var Database = function() {};

inherits(Database, EventEmitter);

Database.prototype.setUri = function(uri) {
  this.uri = uri;
};

module.exports = Database;