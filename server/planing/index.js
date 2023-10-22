
module.exports = function planning($p, log) {

  const {get, reminder} = require('./get')($p, log);
  const post  = require('./post')($p, log, reminder);

  return async function planningHandler(req, res) {
    return req.method === 'GET' ? get(req, res) : post(req, res);
  }

}

module.exports = function planning($p, log, route) {

  if(process.env.PLANNING_DATES) {
    log('planning_dates started');

    const glob = {};
    require('./listener')($p, log, glob);

    const get = require('./get')($p, log, glob);

    route.needs = function needsHandler(req, res) {
      return req.method === 'GET' ? get(req, res) : get(req, res);
    };
  }
  else {
    log('planning_dates skipping');
  }

}
