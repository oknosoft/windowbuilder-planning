

module.exports = function planning_keys($p, log, route) {

  if(process.env.PLANNING_KEYS) {
    const accumulation = require('./init')($p, log);
    require('./subscription')($p, log, accumulation);

    const get = require('./get')($p, log, accumulation);
    const post  = require('./post')($p, log, accumulation, get);
    route.keys = function keysHandler(req, res) {
      return req.method === 'GET' ? get(req, res) : post(req, res);
    };
  }

}
