
function datePrefix(date) {
  const year = date.getFullYear();
  return Number(`1${((year - 2000) * 12 + date.getMonth()).pad(3)}`);
}

module.exports = function ($p, log, acc) {
  const {utils: {sleep, blank}, cat: {branches}, doc: {calc_order}} = $p;

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

  async function keys({doc, ox, branch, abonent, year}) {
    if(ox) {

    }
    else {
      const {rowCount} = await acc.client.query(`SELECT ref from keys WHERE
        obj=$1 and specimen=0 and elm=0 and region=0`, [doc.valueOf()]);
      if(!rowCount) {
        const prefix =  datePrefix(doc.date);
        const pq = await acc.client.query(`SELECT barcode from keys WHERE barcode<$1 and barcode>=$2
            order by barcode desc limit 1`, [Number(`${prefix + 1}00000000`), Number(`${prefix}00000000`)]);
        const barcode = pq.rowCount ? Number(pq.rows[0].barcode) + 1 : Number(`${prefix}00000000`);
        return acc.client.query(`INSERT INTO keys (obj, specimen, elm, region, barcode) VALUES ($1, $2, $3, $4, $5);`,
          [doc.valueOf(), 0, 0, 0, barcode]);
      }
    }
  }

  async function reflect({db, results, branch, abonent, year}) {
    await sleep(4);
    for(const result of results) {
      const {_id, _rev, ...attr} = result.doc;
      attr.ref = _id.substring(15);
      const doc = calc_order.create(attr, false, true);
      const prod = await doc.load_production(true, db);
      // запись в таблице calc_orders
      await order({doc, branch, abonent, year});
      // запись в таблице keys документа Расчёт
      await keys({doc, branch, abonent, year});
      for(const ox of prod) {
        // запись в таблице characteristics
        await cx(ox);
        // запись в таблице keys ключей продукции
        await keys({ox, branch, abonent, year});
      }
      for(const ox of prod) {
        ox.unload();
      }
      doc.unload();
    }
  }

  return reflect;
};
