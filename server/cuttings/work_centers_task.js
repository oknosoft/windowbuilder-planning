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
  const {planning: {main_work_center}} = job_prm;
  const values = [];
  let row_num = 0;
  //register, register_type, row_num, period, sign, work_center, nom, characteristic, len, width, qty, quantity, amount
  for(const row of cuts) {
    if(row.len && row.width) {
      if(row.record_kind.is('Расход')) {
        // деловой обрезок
        row_num++;
        values.push(`('${register}', '${register_type}', ${row_num}, '${period}', 1, '${main_work_center.ref}', '${
          row.nom.ref}', null, ${row.len}, ${row.width}, 1, ${row.len * row.width / 1000000})`);
      }
      else if(cutting.find({stick: row.stick})) {
        // если лист использован...
        row_num++;
        values.push(`('${register}', '${register_type}', ${row_num}, '${period}', -1, '${main_work_center.ref}', '${
          row.nom.ref}', null, ${row.len}, ${row.width}, 1, ${row.len * row.width / 1000000})`);
      }
    }
  }
  if(values.length) {
    const pq = await client.query(`INSERT INTO areg_cuttings (register, register_type, row_num, period, sign, work_center, nom, characteristic, len, width, qty, quantity)
VALUES ${values.join(',\n')}`);
  }

}
