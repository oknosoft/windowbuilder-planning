
const { hrtime } = require('node:process');
const NS_PER_SEC = 1e9;

/**
 * Корневой обработчик post-запросов
 * @param {MetaEngine} $p
 * @param {Function} log
 * @param {Accumulation} accumulation
 * @return Function
 */
module.exports = function ($p, log, acc) {

  const {end: {end500, end404}, getBody} = $p.utils;

  /**
   * Описание ключей по массиву идентификаторов или баркодов
   * @param {Array.<Object>} keys
   * @return {Promise<Array>}
   */
  async function by_ids(keys) {
    let sql = `select keys.ref,
keys.barcode,
calc_orders.ref calc_order,
characteristics.ref characteristic,
keys.specimen,
keys.elm,
keys.region,
keys.type,
case when characteristics.ref is null then calc_orders.number_doc else characteristics.name end presentation,

calc_orders.abonent,
calc_orders.year,
calc_orders.branch
from keys
left outer join characteristics on characteristics.ref = keys.obj
left outer join calc_orders on calc_orders.ref = characteristics.calc_order or calc_orders.ref = keys.obj
`;
    if(keys.every((v) => v.length === 36)) {
      sql += `where keys.ref in (${keys.map(v => `'${v}'`).join(', ')})`;
    }
    else {
      sql += `where keys.barcode in (${keys.map(v => `'${v}'`).join(', ')})`;
    }
    const pq = await acc.client.query(sql);
    return pq.rows;
  }

  /**
   * Описание ключей по массиву свойств
   * @param {Array.<Object>} keys
   * @return {Promise<Array>}
   */
  async function keys(keys) {
    if(keys.some((v) => typeof v === 'string')) {
      return by_ids(keys);
    }
    const tname = `k${Math.floor(Math.random() * 100000)}`;
    const values = keys.map(v => `('${v.obj}', ${v.specimen}, ${v.elm}, ${v.region})`);
    const sql = `create temp table ${tname} of keys_type ON COMMIT DROP;

insert into ${tname} (obj, specimen, elm, region)
VALUES ${values.join(',\n')};

select ${tname}.*, keys.barcode, keys.ref from ${tname} inner join keys on
 ${tname}.obj = keys.obj and ${tname}.specimen = keys.specimen and ${tname}.elm = keys.elm and ${tname}.region = keys.region;`;

    const pq = await acc.client.query(sql);
    if(pq[2].rowCount === keys.length) {
      keys.length = 0;
      for(const row of pq[2].rows) {
        keys.push(row);
      }
    }
    else {
      throw new Error(`Не найден ключ для ${values.join(',\n')}`);
    }
    return keys;
  }

  $p.job_prm.planning_keys = keys;

  return async (req, res) => {
    try{
      let body = JSON.parse(await getBody(req));
      if(Array.isArray(body?.rows)) {
        body = body.rows;
      }
      const {hrtime: start, parsed: {paths, path}} = req;
      let data;
      switch (paths[3]) {
        case 'keys':
        case 'rows':
          data = {rows: await keys(body)};
          const diff = hrtime(start);
          data.took = `${((diff[0] * NS_PER_SEC + diff[1])/1e6).round(1)} ms`;
          log(`keys/rows took=${data.took}`);
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
