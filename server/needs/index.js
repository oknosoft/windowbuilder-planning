
module.exports = function planning_needs($p, log, route) {

  if(process.env.PLANNING_NEEDS) {
    log('planning_needs started');
    $p.md.once('planning_keys', ({subscription, accumulation}) => {
      const {client} = accumulation;
      subscription.listeners.push(async function reflect({db, results, docs, branch, abonent, year}) {
        for(const {doc, prod} of docs) {
          await client.query(`DELETE FROM areg_needs where register = $1 and register_type = 'doc.calc_order'`, [doc.ref]);
          if(docs[0].doc.posted) {
            const values = [];
            for(const row of doc.production) {
              values.push(`('${doc.ref}', 'doc.calc_order', ${row.row}, ${Math.random()})`);
            }
            await client.query(`INSERT INTO areg_needs (register, register_type, row_num, quantity)
                VALUES ${values.join(',\n')}`);
          }
        }
      });
    });
  }
  else {
    log('planning_needs skipping');
  }

}
