
module.exports = function({doc, client, utils}) {
  const values = [];
  const register = doc.ref;
  const register_type = doc.class_name;
  const period = utils.moment(doc.date).format('YYYY-MM-DD HH:mm:ss');
  const sets = new Map();
  for(const row of doc.planning) {
    if(row.power) {
      values.push({
        date: utils.moment(row.date).format('YYYY-MM-DD'),
        shift: row.work_shift.ref,
        work_center: row.work_center.ref,
        power: row.power,
      });
      if(!sets.has(row.work_center)) {
        sets.set(row.work_center, []);
      }
      sets.get(row.work_center).push(row);
    }
  }
  const svalues = values.map((v, index) => `('${register}', '${register_type}', ${index + 1}, '${period
  }', '${v.date}', '${v.shift}', '${v.work_center}', ${v.power})`);
  const sql = `INSERT INTO areg_dates (register, register_type, row_num, period, date, shift, work_center, power) VALUES ${svalues.join(',\n')}`;
  return (svalues.length ? client.query(sql) : Promise.resolve())
    .then(() => {
      const phase = 'plan';
      const sign = 1;
      for(const [work_center, rows] of sets) {
        if(!work_center.register) {
          work_center.register = new work_center._manager.constructor.RowsFragment(work_center);
          work_center._manager.register.add(work_center);
        }
        for(const {date, work_shift, power} of rows) {
          work_center.register.add({date, shift: work_shift, phase, register_type, register, power, sign});
        }
      }
    });
}
