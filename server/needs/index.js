
module.exports = function planning_needs($p, log, route) {

  if(process.env.PLANNING_NEEDS) {
    log('planning_needs started');

    const glob = {};
    require('./listener')($p, log, glob);

    const get = require('./get')($p, log, glob);

    route.needs = function needsHandler(req, res) {
      return req.method === 'GET' ? get(req, res) : get(req, res);
    };
  }
  else {
    log('planning_needs skipping');
  }

}
