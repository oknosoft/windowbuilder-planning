
// дата среза - полгода
const slice = new Date();
slice.setMonth(slice.getMonth() - 7);

function findKey(rows, specimen, elm=0, region=0) {
  return rows.find((v) => v.specimen == specimen && v.elm == elm && v.region == v.region);
}

const keysSQL = 'INSERT INTO keys (obj, specimen, elm, region, barcode, type) VALUES ($1, $2, $3, $4, $5, $6);';

module.exports = function ($p, log, acc) {
  const {utils: {sleep, blank}, cat: {branches}, doc: {calc_order}, enm: {elm_types, inserts_glass_types}} = $p;
  const glrt = require('./glrt')($p);


  async function datePrefix(date) {
    const year = date.getFullYear();
    const prefix = Number(`1${((year - 2000) * 12 + date.getMonth()).pad(3)}`);
    const pq = await acc.client.query(`SELECT barcode from keys WHERE barcode<$1 and barcode>=$2
            order by barcode desc limit 1`, [Number(`${prefix + 1}00000000`), Number(`${prefix}00000000`)]);
    return pq.rowCount ? Number(pq.rows[0].barcode) + 1 : Number(`${prefix}00000000`);
  }

  async function order({doc, branch, abonent, year, prod}) {
    const {ref, date, partner, organization, manager, department, number_doc} = doc;
    const {rowCount, rows} = await acc.client.query(`SELECT branch from calc_orders WHERE ref=$1`, [ref]);
    const values = [
      ref,
      abonent.valueOf(),
      branch.valueOf(),
      year,
      date,
      partner.valueOf(),
      organization.valueOf(),
      manager.valueOf(),
      department.valueOf(),
      number_doc,
    ];
    const production = [];
    for(const row of doc.production) {
      if (prod.includes(row.characteristic)) {
        production.push({nom: row.nom.valueOf(), characteristic: row.characteristic.valueOf(), quantity: row.quantity});
      }
    }
    values.push(JSON.stringify(production));
    if(rowCount) {
      const tb = branches.get(rows[0].branch);
      if(branch.empty() && !tb.empty()) {
        values[2] = tb.valueOf();
      }
      else if(!branch.empty() && tb.empty()) {
        values[2] = branch.valueOf();
      }
      else if(!branch.empty() && !tb.empty()) {
        if(branch._hierarchy(tb)) {
          values[2] = branch.valueOf();
        }
        else if(tb._hierarchy(branch)) {
          values[2] = tb.valueOf();
        }
      }
      return acc.client.query(`UPDATE calc_orders SET
            abonent = $2,
            branch = $3,
            year = $4,
            date = $5,
            partner = $6,
            organization = $7,
            author = $8,
            department = $9,
            number_doc = $10,
            production = $11
            WHERE ref=$1;`, values);
    }
    return acc.client.query(`INSERT INTO calc_orders
            (ref, abonent, branch, year, date, partner, organization, author, department, number_doc, production)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, values);
  }

  async function cx(ox) {
    const obj = ox.valueOf();
    if(obj.length !== 36) {
      return log(new Error(`Ошибка формата uid\nobj=${obj
      }\nbranch='${branch.suffix}' ${branch.valueOf()
      }\nabonent=${abonent.id}`));
    }
    return acc.client.query(`INSERT INTO characteristics (ref, calc_order, leading_product, name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (ref) DO UPDATE SET
        calc_order = EXCLUDED.calc_order,
        leading_product = EXCLUDED.leading_product,
        name = EXCLUDED.name;`, [obj, ox.calc_order.valueOf(), ox.leading_product.valueOf(), ox.name]);
  }

  async function keys({doc, row, branch, abonent, year}) {
    let bartmp;
    async function nextBarcode() {
      if(bartmp) {
        bartmp++;
      }
      else {
        bartmp = await datePrefix(doc.date);
      }
      return bartmp;
    }

    if(row) {
      const {characteristic} = row;
      const obj = characteristic.valueOf();
      if(obj.length !== 36) {
        return log(new Error(`Ошибка формата uid\nobj=${obj
        }\nbranch='${branch.suffix}' ${branch.valueOf()
        }\nabonent=${abonent.id}`));
      }
      try {
        // все записанные ключи текущей продукции
        const keys = await acc.client.query(`SELECT * from keys WHERE obj=$1`, [obj]);
        for(let specimen = 1; specimen <= row.quantity; specimen++) {
          // по умолчанию, создаём для самой продукции, всех её слоёв, палок, заполнений и стёкол заполнений
          if(!findKey(keys.rows, specimen)) {
            const key_type = characteristic.coordinates.count() ? 'product' : 'other';
            await acc.client.query(keysSQL, [obj, specimen, 0, 0, await nextBarcode(), key_type]);
          }
          // для всех слоёв
          for(const layer of characteristic.constructions) {
            if(layer.cnstr && !findKey(keys.rows, specimen, -layer.cnstr)) {
              await acc.client.query(keysSQL, [obj, specimen, -layer.cnstr, 0, await nextBarcode(), 'layer']);
            }
          }
          // для всех элементов, включая раскладку
          const elmnts = new Set();
          for(const {cnstr, elm, elm_type} of characteristic.coordinates) {
            if(!cnstr || !elm || elmnts.has(elm)) {
              continue;
            }
            if(!findKey(keys.rows, specimen, elm)) {
              let key_type;
              switch (elm_type) {
                case elm_types.drainage:
                case elm_types.text:
                case elm_types.line:
                case elm_types.size:
                case elm_types.radius:
                case elm_types.cut:
                case elm_types.tearing:
                case elm_types.attachment:
                case elm_types.adjoining:
                case elm_types.furn:
                case elm_types.compound:
                  continue;
                case elm_types.glass:
                case elm_types.sandwich:
                  key_type = 'filling';
                  break;
                case elm_types.layout:
                  key_type = 'layout';
                  break;
                default:
                  key_type = 'profile';
              }
              await acc.client.query(keysSQL, [obj, specimen, elm, 0, await nextBarcode(), key_type]);
              elmnts.add(elm);

              // для всех рядов состава заполнений
              if(elm_type.is('glass')) {
                characteristic.glass_specification.find_rows({elm})
                  .forEach(async ({_row: {inset, region}}, index) => {
                    if(glrt.includes(inset.insert_glass_type)) {
                      index++;
                      if(!findKey(keys.rows, specimen, elm, index)) {
                        await acc.client.query(keysSQL, [obj, specimen, elm, index, await nextBarcode(), 'glunit']);
                      }
                    }
                  });
              }
            }
          }
        }
      }
      catch (e) {
        throw new Error(`${e.message
        }\nobj=${obj
        }\nbranch='${branch.suffix}' ${branch.valueOf()
        }\nabonent=${abonent.id}`);
      }
    }
    else {
      const {rowCount} = await acc.client.query(`SELECT ref from keys WHERE
        obj=$1 and specimen=0 and elm=0 and region=0`, [doc.valueOf()]);
      if(!rowCount) {
        return acc.client.query(keysSQL, [doc.valueOf(), 0, 0, 0, await nextBarcode(), 'order']);
      }
    }
  }

  async function reflect({db, results, last_seq, branch, abonent, year, direct}) {
    await sleep(2);
    const docs = [];
    for(const result of results) {
      const {_id, _rev, ...attr} = result.doc;
      attr.ref = _id.substring(15);
      if(attr.ref.length !== 36) {
        log(new Error(`Ошибка формата uid\nobj=${attr.ref
        }\nbranch='${branch.suffix}' ${branch.valueOf()
        }\nabonent=${abonent.id}`));
        continue;
      }
      const doc = calc_order.create(attr, false, true);
      const prod = await doc.load_production(true, db);
      docs.push({doc, prod});
      // запись в таблице calc_orders
      await order({doc, branch, abonent, year, prod});
      // запись в таблице keys документа Расчёт
      await keys({doc, branch, abonent, year});

      // ключи продукций и фрагментов продукций, генерируем только для заказов за последние полгода
      if(doc.date > slice || direct) {
        for(const row of doc.production) {
          if(prod.includes(row.characteristic) && row.characteristic.calc_order === doc) {
            // запись в таблице characteristics
            try{
              await cx(row.characteristic);
            }
            catch (e) {
              throw new Error(`${e.message
              }\nobj=${row.characteristic.valueOf()
              }\nbranch='${branch.suffix}' ${branch.valueOf()
              }\nabonent=${abonent.id}`);
            }

            // запись в таблице keys ключей продукции
            await keys({doc, row, branch, abonent, year});
          }
        }
      }
    }
    const prm = branch.empty() ? `a|${abonent.ref}` : `b|${branch.ref}`;
    return {prm, last_seq, docs};
  }

  return reflect;
};
