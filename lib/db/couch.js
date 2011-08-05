var inherits = require('util').inherits
  , Database = require('./database')
  , request  = require('request')
  , follow       = require('follow');

var HEADERS = {
    "content-type": "application/json"
  , "accept": "application/json"
};

var Couch = function() {};

inherits(Couch, Database);

Couch.prototype.setUri = function(uri) {
  if (this.uri) throw new Error('URI is already set on this pipeline');
  this.uri = uri;
};

Couch.prototype._request = function(uri, method, data, done) {
  var options = {
      uri: uri
    , method: method
    , headers: HEADERS
  };
  if (data !== null && data !== undefined) options.body = JSON.stringify(data);
  if (typeof(data) == 'function') done = data;
  
  request(options, function requestCallback(err, resp, dbResponse) {
    var statusCode, response;
    if (err) return done(err);
    statusCode = resp.statusCode;
    if (statusCode < 200 || statusCode > 299)  return done(new Error('Response with status code ' + statusCode));
    response = JSON.parse(dbResponse);
    if (method === 'POST' || method == 'PUT') {
      if (response.ok !== true) {return new done(new Error('CouchDB response not ok: ' + dbResponse));}
      data._id = response.id;
      data._rev = response.rev;
      done(null, data);
    } else {
      done(null, response);
    }
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
  if (! key) return done(new Error('update: key is invalid: ' + key));
  this._request(this.uri + '/' + key, 'PUT', data, done);
};

module.exports = Couch;