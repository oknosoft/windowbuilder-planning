

module.exports = function planning_keys($p, log, route) {

  if(process.env.PLANNING_KEYS) {
    log('planning_keys started');
    const accumulation = require('./init')($p, log);
    require('./subscription')($p, log, accumulation)
      .then(() => {
        log('planning_keys cycle completed');
      });

    const get = require('./get')($p, log, accumulation);
    const post  = require('./post')($p, log, accumulation, get);

    route.keys = function keysHandler(req, res) {
      return req.method === 'GET' ? get(req, res) : post(req, res);
    };
    if(!route.pgsql) {
      route.pgsql = {};
    }
    route.pgsql.keys = require('./feed')($p, log, accumulation);
    route.pgsql.cuttings = require('../cuttings/purchase')($p, log, accumulation);

  }
  else {
    log('planning_keys skipping');
  }

}
