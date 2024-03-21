
/**
 * Обработчик get-запросов дат планирования
 * @param {MetaEngine} $p
 * @param {Function} log
 * @param {Object} glob
 * @return Function
 */
module.exports = function ($p, log, glob) {

  const {utils: {end, moment}, adapters, cat} = $p;

  const sql = `SELECT phase, date, shift, work_center, planing_key, stage, calc_order, sum(sign * power) power  FROM areg_dates
  where phase = $1 and date between $2 and $3
  GROUP BY phase, date, shift, work_center, planing_key, stage, calc_order`;

  async function reminder(query = {}) {
    const pq = await glob.client.query(sql, [
      query.phase || 'plan',
      query.from || moment().startOf('month').toDate(),
      query.till || moment().endOf('month').toDate(),
    ]);
    return pq.rows;
  }

  return async function get(req, res) {
    const {query, parsed: {path, paths}} = req;

    try {
      switch (paths[3]) {
        case 'reminder':
          const rem = await reminder(query);
          return res.end(JSON.stringify(rem));

        default:
          end.end404(res, path);
      }
    }
    catch (err) {
      end.end500({res, err, log});
    }

  }

}
