var inherits = require('util').inherits
  , Database = require('./database')
  , request  = require('request');

var HEADERS    = 
  { "content-type": "application/json"
  , "accept": "application/json"
  };

var Memory = function() {
  this.keys = {};
  this.lastKey = 0;
};

inherits(Memory, Database);

Memory.prototype.get = function(key, done) {
  var self = this;
  process.nextTick(function() {
    done(null, self.keys[key]);
  });
};

Memory.prototype.create = function(data, done) {
  var key = this.lastKey = this.lastKey + 1
    , self = this;
    
  data.id = key;
  this.keys[key] = data;
  done(null, data);

  process.nextTick(function() {
    self.triggerChange(data);
  });
};

Memory.prototype.update = function(key, data, done) {
  var self = this;
  
  if (key in this.keys) {
    this.keys[key] = data;
    data.id = key;
    done(null, data);
  } else {
    done(new Error('key not found: ' + key));
  }
  process.nextTick(function() {
    self.triggerChange(data);
  });
};

module.exports = Memory;