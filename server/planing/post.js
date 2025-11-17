
const { hrtime } = require('node:process');
const NS_PER_SEC = 1e9;

/**
 * Корневой обработчик post-запросов
 * @param {MetaEngine} $p
 * @param {Function} log
 * @param {Accumulation} accumulation
 * @return Function
 */
module.exports = function ($p, log, glob) {

  const {end: {end500, end404}, getBody, generate_guid, moment, blank} = $p.utils;

  const scan = async (body) => {
    const pq = await glob.client.query(`select * from areg_dates where planing_key = $1 and register_type = 'doc.scaning' and phase = $2 and work_center = $3`, [
      body.barcode,
      body.phase || 'ready',
      body.work_center,
    ]);
    const period = moment().format('YYYY-MM-DD HH:mm:ss');
    if(pq.rows.length) {
      const row = pq.rows[0];
      await glob.client.query(`update areg_dates set period=$2, phase=$3, date=$4, shift=$5, stage=$6
      where register=$1 and register_type = 'doc.scaning' and row_num = ${row.row_num}`, [row.register, period, row.phase, period, body.shift || row.shift, body.stage || row.stage]);
    }
    else {
      await glob.client.query(`INSERT INTO areg_dates (register, register_type, row_num, period, phase, date, shift, work_center, planing_key, stage, part, part_type, calc_order, power) VALUES (
'${generate_guid()}', 'doc.scaning', 1, '${period}', '${body.phase || 'ready'}', '${period}', '${body.shift || blank.guid}',
'${body.work_center || blank.guid}', '${body.barcode}', '${body.stage || blank.stage}', null, null, '${body.calc_order}', 1)`);
    }
    return true;
  };

  return async (req, res) => {
    try{
      let body = JSON.parse(await getBody(req));
      if(Array.isArray(body?.rows)) {
        body = body.rows;
      }
      const {hrtime: start, parsed: {paths, path}} = req;
      let data, diff;
      switch (paths[3]) {
        case 'scan':
          data = {ok: await scan(body)};
          diff = hrtime(start);
          data.took = `${((diff[0] * NS_PER_SEC + diff[1])/1e6).round(1)} ms`;
          log(`dates/scan took=${data.took}`);
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
