
const { hrtime } = require('node:process');
const NS_PER_SEC = 1e9;

/**
 * Корневой обработчик get-запросов
 * @param {MetaEngine} $p
 * @param {Function} log
 * @param {Accumulation} acc
 * @return Function
 */
function get($p, log, acc) {
  const {end500} = $p.utils.end;

  return async (req, res) => {
    try{
      const query = await info(req.parsed.paths[3], acc, req.hrtime);
      res.end(JSON.stringify(query, null, '\t'));
    }
    catch (err) {
      end500({req, res, err, log});
    }
  };
}

async function info(code, acc, start) {
  if(code?.length !== 12 && code?.length !== 13 && code?.length !== 36) {
    const err = new Error(`Code length error. Must be 12, 13 or 36 symbols, ${code?.length} received`);
    err.status = 404;
    throw err;
  }
  const pq = await acc.client.query(`select * from qinfo($1)`, [code]);
  if(pq.rowCount) {
    const diff = hrtime(start);
    return Object.assign(pq.rows[0], {took: `${((diff[0] * NS_PER_SEC + diff[1])/1e6).round(1)} ms`});
  }
  const err = new Error(`No records for ${code}`);
  err.status = 404;
  throw err;
}

get.info = info;

module.exports = get;
