
const { hrtime } = require('node:process');
const NS_PER_SEC = 1e9;

/**
 * Корневой обработчик get-запросов
 * @param {MetaEngine} $p
 * @param {Function} log
 * @param {Accumulation} acc
 * @return Function
 */
function get($p, log, glob) {
  const {utils} = $p;
  const {end500, end404} = utils.end;

  return async (req, res) => {
    try{

      if(!glob.client) {
        throw new Error('Postgres client not found');
      }

      let data;
      const {hrtime, query, parsed: {paths, path}} = req;
      switch (paths[3]) {
        case 'totals':
          data = await totals({query, utils, client: glob.client});
          break;
        default:
          return end404(res, path);
      }
      res.end(JSON.stringify(data, null, '\t'));
    }
    catch (err) {
      end500({req, res, err, log});
    }
  };
}

async function totals({query, utils, client}) {
  let {calc_order: ref, detail} = query;
  if(!detail?.startsWith(',')) {
    detail = `, ${detail}`;
  }
  let sql = `SELECT nom, characteristic%1, sum(sign * quantity) quantity FROM public.areg_needs
where calc_order=$1 group by nom, characteristic%1`.replace(/%1/g, detail || '');
  if(utils.is_guid(ref)) {
    const pq = await client.query(sql, [ref]);
    const rows = (pq.rows || [])
      .map(({quantity, ...row}) => ({...row, quantity: parseFloat(quantity)}));
    return {
      ok: true,
      rows,
    };
  }
  else {
    throw new Error(`Неверный формат ссылки ${ref}`);
  }
}

module.exports = get;
