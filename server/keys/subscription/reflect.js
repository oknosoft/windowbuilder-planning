
// дата среза - полгода
const slice = new Date();
slice.setMonth(slice.getMonth() - 7);

function findKey(rows, specimen, elm=0, region=0) {
  return rows.find((v) => v.specimen == specimen && v.elm == elm && v.region == v.region);
}

const keysSQL = 'INSERT INTO keys (obj, specimen, elm, region, barcode) VALUES ($1, $2, $3, $4, $5);';

module.exports = function ($p, log, acc) {
  const {utils: {sleep, blank}, cat: {branches}, doc: {calc_order}} = $p;

  async function datePrefix(date) {
    const year = date.getFullYear();
    const prefix = Number(`1${((year - 2000) * 12 + date.getMonth()).pad(3)}`);
    const pq = await acc.client.query(`SELECT barcode from keys WHERE barcode<$1 and barcode>=$2
            order by barcode desc limit 1`, [Number(`${prefix + 1}00000000`), Number(`${prefix}00000000`)]);
    return pq.rowCount ? Number(pq.rows[0].barcode) + 1 : Number(`${prefix}00000000`);
  }

  async function order({doc, branch, abonent, year}) {
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
      number_doc
    ];
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
            number_doc = $10
            WHERE ref=$1;`, values);
    }
    return acc.client.query(`INSERT INTO calc_orders
            (ref, abonent, branch, year, date, partner, organization, author, department, number_doc)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, values);
  }

  async function cx(ox) {
    return acc.client.query(`INSERT INTO characteristics (ref, calc_order, leading_product, name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (ref) DO UPDATE SET
        calc_order = EXCLUDED.calc_order,
        leading_product = EXCLUDED.leading_product,
        name = EXCLUDED.name;`, [ox.valueOf(), ox.calc_order.valueOf(), ox.leading_product.valueOf(), ox.name]);
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
      const obj = characteristic.valueOf()
      // все записанные ключи текущей продукции
      const keys = await acc.client.query(`SELECT * from keys WHERE obj=$1`, [obj]);
      for(let specimen = 1; specimen <= row.quantity; specimen++) {
        // по умолчанию, создаём для самой продукции, всех её слоёв, палок, заполнений и стёкол заполнений
        if(!findKey(keys.rows, specimen)) {
          await acc.client.query(keysSQL, [obj, specimen, 0, 0, await nextBarcode()]);
        }
        // для всех слоёв
        for(const layer of characteristic.constructions) {
          if(!findKey(keys.rows, -layer.cnstr)) {
            await acc.client.query(keysSQL, [obj, specimen, -layer.cnstr, 0, await nextBarcode()]);
          }
        }
        // для всех элементов, включая раскладку
        for(const {elm} of characteristic.coordinates) {
          if(!findKey(keys.rows, elm)) {
            await acc.client.query(keysSQL, [obj, specimen, elm, 0, await nextBarcode()]);
          }
        }
        // для всех рядов состава заполнений
        for(const region of characteristic.glass_specification) {
          if(!findKey(keys.rows, region.elm)) {
            await acc.client.query(keysSQL, [obj, specimen, region.elm, 0, await nextBarcode()]);
          }
        }
      }
    }
    else {
      const {rowCount} = await acc.client.query(`SELECT ref from keys WHERE
        obj=$1 and specimen=0 and elm=0 and region=0`, [doc.valueOf()]);
      if(!rowCount) {
        return acc.client.query(keysSQL, [doc.valueOf(), 0, 0, 0, await nextBarcode()]);
      }
    }
  }

  async function reflect({db, results, branch, abonent, year}) {
    await sleep(4);
    for(const result of results) {
      const {_id, _rev, ...attr} = result.doc;
      attr.ref = _id.substring(15);
      const doc = calc_order.create(attr, false, true);
      // запись в таблице calc_orders
      await order({doc, branch, abonent, year});
      // запись в таблице keys документа Расчёт
      await keys({doc, branch, abonent, year});

      // ключи продукций и фрагментов продукций, генерируем только для заказов за последние полгода
      if(doc.date > slice) {
        const prod = await doc.load_production(true, db);
        for(const row of doc.production) {
          if(prod.includes(row.characteristic)) {
            // запись в таблице characteristics
            await cx(row.characteristic);
            // запись в таблице keys ключей продукции
            await keys({doc, row, branch, abonent, year});
          }
        }
        for(const ox of prod) {
          ox.unload();
        }
      }

      doc.unload();
    }
  }

  return reflect;
};
