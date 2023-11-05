
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
      let result;
      const {hrtime, query, parsed: {paths}} = req;
      const code = paths[3];
      switch (code) {
        case 'order':
          result = await order(paths[4], acc, hrtime, query, $p);
          break;
        case 'product':
          result = await product(paths[4], acc, hrtime);
          break;
        default:
          result = await info(code, acc, hrtime);
      }
      res.end(JSON.stringify(result, null, '\t'));
    }
    catch (err) {
      end500({req, res, err, log});
    }
  };
}

function refLength(ref) {
  if(ref?.length !== 36) {
    const err = new Error(`ref length error. Must be 36 symbols, ${ref?.length} received`);
    err.status = 404;
    throw err;
  }
}

function fin(pq, start, code) {
  if(pq.rowCount) {
    const diff = hrtime(start);
    const took = `${((diff[0] * NS_PER_SEC + diff[1])/1e6).round(1)} ms`;
    if(pq.rowCount > 1) {
      return {rows: pq.rows, took};
    }
    return Object.assign(pq.rows[0], {took});
  }
  const err = new Error(`No records for ${code}`);
  err.status = 404;
  throw err;
}

async function product(ref, acc, start) {
  refLength(ref);
  const pq = await acc.client.query(
    `select ref as qr, barcode, specimen, elm, region, type from keys where obj=$1`, [ref]);
  return fin(pq, start, ref);
}

async function order(ref, acc, start, query, $p) {
  refLength(ref);
  const byOrder = `select calc_orders.*, keys.ref as qr, keys.barcode from calc_orders inner join keys on keys.obj=calc_orders.ref where calc_orders.ref=$1`;
  let pq = await acc.client.query(byOrder, [ref]);
  const {utils, cat} = $p;
  if(!pq.rowCount && query.zone && query.branch) {
    const abonent = utils.is_guid(query.zone) ? cat.abonents.get(query.zone) : cat.abonents.by_id(query.zone);
    const branch = utils.is_guid(query.branch) ? cat.branches.get(query.branch) : cat.branches.find({suffix: query.branch});

    if(!branch.is_new() && branch.owner === abonent) {
      const year = parseFloat(query.year) || new Date().getFullYear();
      await acc.subscription.direct({abonent, year, branch, ref});
      pq = await acc.client.query(byOrder, [ref]);
    }
  }
  return fin(pq, start, ref);
}

async function info(code, acc, start) {
  if(code?.length !== 12 && code?.length !== 13 && code?.length !== 36) {
    const err = new Error(`Code length error. Must be 12, 13 or 36 symbols, ${code?.length} received`);
    err.status = 404;
    throw err;
  }
  const pq = await acc.client.query(`select * from qinfo($1)`, [code]);
  return fin(pq, start, code);
}

get.info = info;

module.exports = get;
