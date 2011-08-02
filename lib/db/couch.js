var extend   = require('util').extend
  , database = require('./database')
  , request  = require('request');

var HEADERS    = 
  { "content-type": "application/json"
  , "accept": "application/json"
  };

var Couch = function() {
};

extend(Couch, Database);

Couch.prototype.get = function(key, callback) {
  this.request()
};

Couch.prototype._request = function(uri, method, data, done) {
  var options = 
    { uri: uri
    , method: method
    , headers: HEADERS
    };
  if (data !== null && data !== undefined) options.body = JSON.stringify(data);
  if (typeof(data) == 'function') done = data;

  request(options, function requestCallback(err, resp, dbResponse) {
    var statusCode = resp.statusCode;
    if (statusCode < 200 || statusCode > 299) {
      done(new Error('Response with status code ' + statusCode))
      return;
    }
    done(null, JSON.parse(dbResponse));
  });  
};

Couch.prototype.get = function(key, done) {
  this._request(this.uri + '/' + key, 'GET', done);
};

Couch.prototype.create = function(data, done) {
  this._request(this.uri, 'POST', data, function(err, resp) {
    if (err) return done(err);
    done(null, resp);
  });
};

Couch.prototype.update = function(key, data, done) {
  this._request(this.uri + '/' + key, 'POST', data, done);
};

module.exports = Couch;