
module.exports = async function nsql(doc, {job_prm, utils}) {
  const values = [];
  const keys = [];
  for (const row of doc.production) {
    if (row.characteristic.calc_order === doc) {
      const {characteristic} = row;
      for (let specimen = 1; specimen <= row.quantity; specimen++) {
        for (const srow of characteristic.specification) {
          if(!srow.stage.empty()) {
            const arow = {
              obj: characteristic.ref,
              specimen,
              elm: srow.elm,
              region: typeof srow.specify === 'number' ? srow.specify : 0,
              nom: srow.nom,
              characteristic: srow.characteristic,
              stage: srow.stage,
              quantity: srow.totqty1,
            }
            values.push(arow);
            if(!keys.find((key) =>
              key.obj === arow.obj && key.specimen === specimen && key.elm === srow.elm && key.region === arow.region)) {
              keys.push({obj: arow.obj, specimen, elm: srow.elm, region: arow.region});
            }
          }
        }
      }
    }
  }
  await job_prm.planning_keys(keys);
  for(const arow of values) {
    const krow = keys.find((key) =>
      key.obj === arow.obj && key.specimen === arow.specimen && key.elm === arow.elm && key.region === arow.region);
    if(krow) {
      arow.planing_key = krow.ref;
    }
  }
  const period = job_prm.$p.utils.moment().format('YYYY-MM-DD HH:mm:ss');
  const svalues = values.map((v, index) => `('${doc.ref}', 'doc.calc_order', ${index + 1}, '${period
  }', '${v.nom.valueOf()}', '${v.characteristic.valueOf()}', '${v.stage.valueOf()}', '${v.planing_key}', ${v.quantity})`);
  return `INSERT INTO areg_needs (register, register_type, row_num, period, nom, characteristic, stage, planing_key, quantity)
VALUES ${svalues.join(',\n')}`;
};
