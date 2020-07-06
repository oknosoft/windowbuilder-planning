
module.exports = function planning($p, log) {

  const {get, reminder} = require('./get')($p, log);
  const post  = require('./post')($p, log, reminder);

  return async function planningHandler(req, res) {
    return req.method === 'GET' ? get(req, res) : post(req, res);
  }

}
