
// Проведение задания на производство и события планирования
// просто, закидываем в регистр табчасть набора

module.exports = function({doc, client, utils}) {
  const values = [];
  const register = doc.ref;
  const register_type = doc.class_name;
  const period = utils.moment(doc.date).format('YYYY-MM-DD HH:mm:ss');
  return doc.load_keys()
    .then(() => {
      for(const {obj, record_kind, phase, date, work_shift, work_center, stage, power} of doc.set) {
        if(power && obj.id) {
          values.push({
            sign: record_kind,
            phase: phase.valueOf(),
            date: utils.moment(date).format('YYYY-MM-DD'),
            shift: work_shift.ref,
            work_center: work_center.ref,
            planing_key: obj.id,
            stage: stage.ref,
            calc_order: obj.calc_order.ref,
            power,
          });
        }
      }
      const svalues = values.map((v, index) => `('${register}', '${register_type}', ${index + 1}, '${period}', ${
        v.sign}, '${v.phase}', '${v.date}', '${v.shift}', '${v.work_center}', ${v.planing_key}, '${v.stage}', '${v.calc_order}', ${v.power})`);
      const sql = `INSERT INTO areg_dates (register, register_type, row_num, period, sign, phase, date, shift, work_center, planing_key, stage, calc_order, power) VALUES ${svalues.join(',\n')}`;
      return svalues.length ? client.query(sql) : Promise.resolve();
    });
};
