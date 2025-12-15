
const { hrtime } = require('node:process');
const NS_PER_SEC = 1e9;

module.exports = function ($p, log, acc) {

  const {utils: {end: {end500, end404}, getBody}, cat: {characteristics}, job_prm: {planning: {main_work_center}}} = $p;

  return async (req, res) => {
    try{
      const {hrtime: start, parsed: {paths, path}} = req;
      let {register, register_type, rows} = JSON.parse(await getBody(req));
      if(!['doc.purchase', 'doc.selling', 'doc.inventory_goods'].includes(register_type)) {
        log(`register_type: ${register_type}`);
        register_type = 'doc.inventory_goods';
      }

      await acc.client.query('delete from areg_cuttings where register = $1 and register_type = $2', [register, register_type]);
      const values = rows.map((v) => {
        const characteristic = characteristics.get(v.characteristic);
        //register, register_type, row_num, period, sign, work_center, nom, characteristic, len, width, qty, quantity, amount
        const area = characteristic.x * characteristic.y / 1000000;
        if(area) {
          const qty = (v.quantity * 10 / area).round() / 10;
          return `('${register}', '${register_type}', ${v.row_num}, '${v.period}', ${v.sign}, '${main_work_center.ref}', '${
            v.nom}', null, ${characteristic.x}, ${characteristic.y}, ${qty}, ${v.quantity})`;
        }
      })
        .filter(v => v);

      const data = {ok: true};
      if(values.length) {
        const pq = await acc.client.query(`INSERT INTO areg_cuttings (register, register_type, row_num, period, sign, work_center, nom, characteristic, len, width, qty, quantity)
VALUES ${values.join(',\n')}`);
        data.rowCount = pq.rowCount;
      }

      const diff = hrtime(start);
      data.took = `${((diff[0] * NS_PER_SEC + diff[1])/1e6).round(1)} ms`;
      log(`cuttings/purchase took=${data.took}`);
      res.end(JSON.stringify(data, null, '\t'));
    }
    catch (err) {
      end500({req, res, err, log});
    }
  };
}
