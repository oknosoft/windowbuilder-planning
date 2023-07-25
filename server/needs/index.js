
module.exports = function planning_needs($p, log, route) {

  if(process.env.PLANNING_NEEDS) {
    log('planning_needs started');

    const nsql = require('./nsql');

    $p.md.once('planning_keys', ({subscription, accumulation}) => {
      const {client} = accumulation;
      subscription.listeners.push(async function reflect({db, results, docs, branch, abonent, year}) {
        for(const {doc, prod} of docs) {
          await client.query(`DELETE FROM areg_needs where register = $1 and register_type = 'doc.calc_order'`, [doc.ref]);
          if(docs[0].doc.posted) {
            await client.query(nsql(doc));
          }
        }
      });
    });
  }
  else {
    log('planning_needs skipping');
  }

}
