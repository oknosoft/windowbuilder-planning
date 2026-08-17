
const { hrtime } = require('node:process');
const NS_PER_SEC = 1e9;
const sqlReminders = `SELECT nom, len, width, sum(qty * sign) qty, sum(quantity * sign) quantity
 FROM areg_cuttings
 where nom = ANY ($1)
  and not (register = $2 and register_type = $3)
   group by nom, len, width having sum(qty * sign) > 0`;

module.exports = function ($p, log, acc) {

  const {end: {end500, end404}, getBody, blank} = $p.utils;

  return async (req, res) => {
    try{
      const {hrtime: start, parsed: {paths, path}} = req;
      let {nom, ref, type} = JSON.parse(await getBody(req));

      const pq = await acc.client.query(sqlReminders, [nom, ref || blank.guid, type || 'doc.purchase']);
      const data = {ok: true, rows: pq.rows};

      const diff = hrtime(start);
      data.took = `${((diff[0] * NS_PER_SEC + diff[1])/1e6).round(1)} ms`;
      log(`cuts/reminders took=${data.took}`);
      res.end(JSON.stringify(data, null, '\t'));
    }
    catch (err) {
      end500({req, res, err, log});
    }
  };
}

module.exports.sqlReminders = sqlReminders;
module.exports.sqlRemindersAll = sqlReminders.replace('> 0', '<> 0');
