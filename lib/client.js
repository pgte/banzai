var Pipeline = require('./pipeline');

module.exports.pipeline = function pipeline(name) {
  return new Pipeline(name);
};