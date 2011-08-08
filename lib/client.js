var Pipeline = require('./pipeline');

module.exports.pipeline = function pipeline(name, options) {
  return new Pipeline(name, options);
};