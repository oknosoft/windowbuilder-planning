const {sqlRemindersAll} = require('./reminders');

/**
 * @summary Проведение по регистру деловой обрези
 * @param doc
 * @param client
 * @param utils
 * @param job_prm
 * @return {Promise<void>}
 */
module.exports = async function cuts({doc, client, utils, job_prm}) {
  const {ref: register, class_name: register_type, materials, transactions_kind} = doc;
  const period = utils.moment(doc.date).format('YYYY-MM-DD HH:mm:ss');
  const {planning: {main_work_center: {ref: work_center}}} = job_prm;
  const values = [];
  let row_num = 0;
  //register, register_type, row_num, period, sign, work_center, nom, characteristic, len, width, qty, quantity, amount
  if(transactions_kind.is('current') || transactions_kind.is('inventory')) {
    // инвентаризация текущих
    // получим остатки
    const noms = new Set();
    for(const row of materials) {
      noms.add(row.nom);
    }
    const {rows} = await client.query(sqlRemindersAll, [Array.from(noms).map(v => v.ref)]);
    if(rows?.length) {
      for(const rem of rows) {
        rem.len = parseFloat(rem.len);
        rem.width = parseFloat(rem.width);
        rem.qty = parseFloat(rem.qty);
        rem.quantity = parseFloat(rem.quantity);
      }

      for(const row of materials) {
        const rem = rows.find((rem) => rem.nom == row.nom && rem.len === row.len && rem.width === row.width);
        if(rem) {
          const qty = row.qty - rem.qty;
          if(qty) {
            row_num++;
            values.push(`('${register}', '${register_type}', ${row_num}, '${period}', ${qty > 0 ? 1 : -1}, '${work_center}', '${
              row.nom.ref}', null, ${row.len}, ${row.width}, ${Math.abs(qty)}, ${Math.abs(row.quantity - rem.quantity)})`);
          }
          rows.splice(rows.indexOf(rem), 1);
        }
        else {
          row_num++;
          values.push(`('${register}', '${register_type}', ${row_num}, '${period}', 1, '${work_center}', '${
            row.nom.ref}', null, ${row.len}, ${row.width}, ${row.qty}, ${row.quantity})`);
        }
      }

      for(const row of rows) {
        row_num++;
        values.push(`('${register}', '${register_type}', ${row_num}, '${period}', ${row.qty > 0 ? -1 : 1}, '${work_center}', '${
          row.nom}', null, ${row.len}, ${row.width}, ${Math.abs(row.qty)}, ${Math.abs(row.quantity)})`);
      }
    }
  }

  if(!values.length) {
    // posting - оприходование или expense - списание
    const sign = transactions_kind.is('expense') ? -1 : 1;
    for(const row of materials) {
      row_num++;
      values.push(`('${register}', '${register_type}', ${row_num}, '${period}', ${sign}, '${work_center}', '${
        row.nom.ref}', null, ${row.len}, ${row.width}, ${row.qty}, ${row.quantity})`);
    }
  }

  if(values.length) {
    await client.query(`INSERT INTO areg_cuttings (register, register_type, row_num, period, sign, work_center, nom, characteristic, len, width, qty, quantity)
VALUES ${values.join(',\n')}`);
  }
};
