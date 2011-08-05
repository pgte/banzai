var Promise = function(isError) {
  this._fulfilled = false;
  this._callbacks = [];
  if (! isError) {
    this._errorPromise = new Promise(true);
  }
};

Promise.prototype._fireOne = function(callback) {
  callback.apply(this, this.results);
};

Promise.prototype._fire = function() {
  var self = this;
  this._fulfilled = true;
  this._callbacks.forEach(function(callback) {
    self._fireOne(callback);
  });
  this._callbacks = [];
};

Promise.prototype.fulfill = function() {
  this._fulfilled = true;
  this.results = arguments;
  this._fire();
};

Promise.prototype.then = function(callback) {
  if (! this._fulfilled) {
    this._callbacks.push(callback);
  } else {
    process.nextTick(function() {
      this._fireOne(callback);
    });
  }
  return this;
};

Promise.prototype.fulfilled = function() {
  return this._fulfilled;
};

Promise.prototype.error = function(callback) {
  this._errorPromise.then(callback);
  return this;
};

Promise.prototype.setError = function(err) {
  this._errorPromise.fulfill(err);
  return this;
};

module.exports = Promise;