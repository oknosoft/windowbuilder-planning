
// planing_key сейчас исключён
const sql = `SELECT calc_order,
sum(case when sign=1 then power else 0 end) as debit,
sum(case when sign=-1 then power else 0 end) as credit
FROM public.areg_dates
where calc_order =ANY($1) and phase = 'run'
group by calc_order`;

module.exports = async function({client, accumulation, orders}) {
  if(orders.length) {
    const req = await client.query(sql, [orders.map(v => v.ref)]);
    for(const order of orders) {
      const row = req.rows.find(v => v.calc_order == order);
      let debit = 0, credit = 0, indicator = 0;
      if(row) {
        debit = parseFloat(row.debit);
        credit = parseFloat(row.credit);
      }
      const delta = debit - credit;
      if(debit > 0) {
        if(delta) {
          indicator = (100 - delta * 100 / debit).round();
        }
        else {
          indicator = 100;
        }
      }
      else if(debit) {
        indicator = 200;
      }

      await accumulation.client.query(`update doc_calc_order set tasked = $2, where ref = $1`, [order, indicator]);
    }
  }
}
