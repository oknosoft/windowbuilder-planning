
/**
 * Обработчик get-запросов дат планирования
 * @param {MetaEngine} $p
 * @param {Function} log
 * @param {Object} glob
 * @return Function
 */
module.exports = function ($p, log, glob) {

  const {utils: {end, moment}, adapters, cat} = $p;

  const sqlRem = `select rem.*, keys.ref, keys.obj, keys.specimen, keys.elm, keys.type  from
  (select date, shift, work_center, planing_key barcode, stage, part, part_type, calc_order, sum(sign * power) power  FROM areg_dates
  where phase = $1 and date between $2 and $3
  group by date, shift, work_center, barcode, stage, part, part_type, calc_order having sum(sign * power) > 0) rem
  left outer join keys on rem.barcode = keys.barcode order by date`;

  const sqlKey = `select areg_dates.*, keys.ref, keys.obj, keys.specimen, keys.elm, keys.type  from areg_dates
  left outer join keys on areg_dates.planing_key = keys.barcode
    where areg_dates.planing_key = $1 order by date`;

  async function reminder(query = {}) {
    const pq = await glob.client.query(sqlRem, [
      query.phase || 'plan',
      query.from || moment().startOf('month').toDate(),
      query.till || moment().endOf('month').toDate(),
    ]);
    return pq.rows;
  }

  async function key(query = {}) {
    const {key, keys} = query;
    const pq = await glob.client.query(sqlKey, [key]);
    return pq.rows;
  }

  return async function get(req, res) {
    const {query, parsed: {path, paths}} = req;

    try {
      switch (paths[3]) {
        case 'reminder':
          return res.end(JSON.stringify(await reminder(query)));

        case 'key':
        case 'keys':
          return res.end(JSON.stringify(await key(query)));

        default:
          end.end404(res, path);
      }
    }
    catch (err) {
      end.end500({res, err, log});
    }

  }

}
