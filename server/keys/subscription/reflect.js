
module.exports = function ($p, log, accumulation) {
  const {utils: {sleep}, doc: {calc_order}} = $p;

  async function order(doc) {

  }

  async function cx(ox) {

  }

  async function keys(doc, ox) {
    if(ox) {

    }
    else {

    }
  }

  async function reflect({db, results, branch, abonent, year}) {
    await sleep(4);
    for(const result of results) {
      const {_id, _rev, ...attr} = result.doc;
      attr.ref = _id.substring(15);
      const doc = calc_order.create(attr, false, true);
      const prod = await doc.load_production(false, db);
      // запись в таблице calc_orders
      await order(doc);
      // запись в таблице keys документа Расчёт
      await keys(doc);
      for(const ox of prod) {
        // запись в таблице characteristics
        await cx(ox);
        // запись в таблице keys ключей продукции
        await keys(doc, ox);
      }
      for(const ox of prod) {
        ox.unload();
      }
      doc.unload();
    }
  }

  return reflect;
};
