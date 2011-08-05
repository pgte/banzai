var inherits = require('util').inherits
  , Database = require('./database');

var Memory = function() {
  this.keys = {};
  this.lastKey = 0;
};

inherits(Memory, Database);

Memory.prototype.get = function(key, done) {
  console.log('get: ' + key + ' got: ' + JSON.stringify(this.keys[key]));
  var self = this;
  done(null, this.keys[key]);
};

Memory.prototype.create = function(data, done) {
  console.log('create: ' + JSON.stringify(data));
  var key = this.lastKey = this.lastKey + 1
    , self = this;
    
  data.id = key;
  this.keys[key] = data;
  done(null, data);
};

Memory.prototype.update = function(key, data, done) {
  console.log('update: ' + key + ', ' + JSON.stringify(data));
  var self = this;
  
  if (this.keys.hasOwnProperty(key)) {
    this.keys[key] = data;
    data.id = key;
    done(null, data);
  } else {
    done(new Error('key not found: ' + key));
  }
};

module.exports = Memory;