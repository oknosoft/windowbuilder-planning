
module.exports = function listener($p, log, glob) {

  const nsql = require('./nsql');

  $p.md.once('planning_keys', ({subscription, accumulation}) => {
    const {client} = accumulation;
    glob.client = client;
    subscription.listeners.push(async function reflect({db, results, docs, branch, abonent, year}) {
      for(const {doc, prod} of docs) {
        // при любом изменении документа, удаляем старые записи
        await client.query(`DELETE FROM areg_needs where register = $1 and register_type = 'doc.calc_order'`, [doc.ref]);
        if(doc.posted) {
          // если документ проведён, добавляем новые
          const sql = await nsql(doc, $p);
          await client.query(sql);
        }
      }
    });
  });
}
