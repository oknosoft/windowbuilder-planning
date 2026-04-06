const {sqlReminders} = require('./reminders');

/**
 * @summary Проведение по регистру деловой обрези
 * @param doc
 * @param client
 * @param utils
 * @param job_prm
 * @return {Promise<void>}
 */
module.exports = async function task_cuts({doc, client, utils, job_prm}) {
  const {ref: register, class_name: register_type, cuts, cutting} = doc;
  const period = utils.moment(doc.date).format('YYYY-MM-DD HH:mm:ss');
  const {planning: {main_work_center: {ref: work_center}}} = job_prm;
  // получим остатки
  const noms = new Set();
  for(const row of cuts) {
    noms.add(row.nom);
  }
  const pq = await client.query(sqlReminders, [Array.from(noms).map(v => v.ref)]);
  if(pq.rows?.length) {
    for(const rem of pq.rows) {
      rem.len = parseFloat(rem.len);
      rem.width = parseFloat(rem.width);
      rem.qty = parseFloat(rem.qty);
    }
    const values = [];
    let row_num = 0;
    //register, register_type, row_num, period, sign, work_center, nom, characteristic, len, width, qty, quantity, amount
    for(const row of cuts) {
      const area = row.len * row.width / 1000000;
      if(area) {
        if(row.record_kind.is('Расход')) {
          // деловой обрезок
          row_num++;
          values.push(`('${register}', '${register_type}', ${row_num}, '${period}', 1, '${work_center}', '${
            row.nom.ref}', null, ${row.len}, ${row.width}, 1, ${area})`);
        }
        else if(cutting.find({stick: row.stick})) {
          // если лист использован...
          const rem = pq.rows.find((rem) => rem.nom == row.nom && rem.len === row.len && rem.width === row.width);
          if(rem?.qty >= 0) {
            rem.qty -= 1;
            row_num++;
            values.push(`('${register}', '${register_type}', ${row_num}, '${period}', -1, '${work_center}', '${
              row.nom.ref}', null, ${row.len}, ${row.width}, 1, ${area})`);
          }
          else {
            const rem = pq.rows.find((rem) => rem.nom == row.nom && rem.len === row.width && rem.width === row.len);
            if(rem?.qty >= 0) {
              rem.qty -= 1;
              row_num++;
              values.push(`('${register}', '${register_type}', ${row_num}, '${period}', -1, '${work_center}', '${
                row.nom.ref}', null, ${row.width}, ${row.len}, 1, ${area})`);
            }
          }
        }
      }
    }
    if(values.length) {
      await client.query(`INSERT INTO areg_cuttings (register, register_type, row_num, period, sign, work_center, nom, characteristic, len, width, qty, quantity)
VALUES ${values.join(',\n')}`);
    }
  }
}
