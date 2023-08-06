
/**
 * Корневой обработчик post-запросов
 * @param {MetaEngine} $p
 * @param {Function} log
 * @param {Accumulation} accumulation
 * @return Function
 */
module.exports = function ($p, log, acc) {

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

  };
}
