
module.exports = function nsql(doc, glrt) {
  const values = [];
  const keys = [];
  for (const row of doc.production) {
    if (row.characteristic.calc_order === doc) {
      const {characteristic} = row;
      for (let specimen = 1; specimen <= row.quantity; specimen++) {
        for (const srow of characteristic.specification) {
          for (const prow of srow.nom.demand) {
            if (srow.elm > 0 && prow.kind.applying.is('region')) {
              const crow = characteristic.constructions.find({elm: srow.elm});
              if(crow.elm_type.is('glass')) {
                characteristic.glass_specification.find_rows({elm: srow.elm})
                  .forEach(({_row: {inset, region}}, inner) => {
                    if(glrt.includes(inset.insert_glass_type)) {
                      inner++;
                      keys.push({obj: row.characteristic.ref, specimen, elm: srow.elm, region: inner});
                    }
                  });
              }

            }
          }
        }
      }
      values.length = 0;
      values.push(`('${doc.ref}', 'doc.calc_order', ${row.row}, ${Math.random()})`);
    }
  }
  return `INSERT INTO areg_needs (register, register_type, row_num, quantity) VALUES ${values.join(',\n')}`;
};
