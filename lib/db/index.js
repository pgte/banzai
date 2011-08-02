var types = {
    'couch': require('./couch')
};

module.exports.findByType = function(typeName) {
  var type = types[typeName];
  if (! type) return;
  return new type();
};