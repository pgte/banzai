var inherits = require('util').inherits
  , Database = require('./database')
  , request  = require('request')
  , follow       = require('follow');

var HEADERS    = 
  { "content-type": "application/json"
  , "accept": "application/json"
  };

var Couch = function() {};

inherits(Couch, Database);

Couch.prototype.startFollowing = function() {
  var self = this;
  follow({db:this.uri, include_docs:true}, function(error, change) {
    var doc;
    if (error || change.deleted || !("doc" in change)) return;
    doc = change.doc;
    console.log('follow: ' + JSON.stringify(doc));
    self.triggerChange(doc);
  });
};

Couch.prototype.setUri = function(uri) {
  if (this.uri) throw new Error('URI is already set on this pipeline');
  this.uri = uri;
  this.startFollowing();
};

Couch.prototype._request = function(uri, method, data, done) {
  var options = 
    { uri: uri
    , method: method
    , headers: HEADERS
    };
  if (data !== null && data !== undefined) options.body = JSON.stringify(data);
  if (typeof(data) == 'function') done = data;
  
  console.log(JSON.stringify(options));

  request(options, function requestCallback(err, resp, dbResponse) {
    var respObject;
    if (err) return done(err);
    var statusCode = resp.statusCode;
    if (statusCode < 200 || statusCode > 299) {
      done(new Error('Response with status code ' + statusCode))
      return;
    }
    respObject = JSON.parse(dbResponse);
    done(null, respObject);
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