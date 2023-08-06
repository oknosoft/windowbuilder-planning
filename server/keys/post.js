
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
   *
   * @param {Array.<Object>} keys
   * @return {Promise<Array>}
   */
  async function keys(keys) {
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
