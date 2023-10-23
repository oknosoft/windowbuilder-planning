
module.exports = function({doc, client, utils}) {
  const values = [];
  const register = doc.ref;
  const register_type = doc.class_name;
  const period = utils.moment(doc.date).format('YYYY-MM-DD HH:mm:ss');
  for(const row of doc.planning) {
    if(row.power) {
      values.push({
        date: utils.moment(row.date).format('YYYY-MM-DD'),
        shift: row.work_shift.ref,
        work_center: row.work_center.ref,
        power: row.power,
      });
    }
  }
  const svalues = values.map((v, index) => `('${register}', '${register_type}', ${index + 1}, '${period
  }', '${v.date}', '${v.shift}', '${v.work_center}', ${v.power})`);
  const sql = `INSERT INTO areg_dates (register, register_type, row_num, period, date, shift, work_center, power) VALUES ${svalues.join(',\n')}`;
  return client.query(sql);
}
