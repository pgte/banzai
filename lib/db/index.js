var types = {
    'couch': require('./couch')
  , 'memory': require('./memory')
};

module.exports.findByType = function(typeName) {
  var db = types[typeName];
  if (! db) return;
  return new db();
};