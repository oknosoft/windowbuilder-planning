

module.exports = function planning_keys($p, log) {

  const get = require('./get')($p, log);
  const post  = require('./post')($p, log);

  if(process.env.PLANNING_KEYS) {
    require('./init')($p, log);
    require('./subscription')($p, log);
  }

  return async function planningHandler(req, res) {
    return req.method === 'GET' ? get(req, res) : post(req, res);
  }

}
