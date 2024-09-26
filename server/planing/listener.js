
const performance = require('./documents/performance');
const calc_order = require('./documents/order');
const task = require('./documents/task');

module.exports = function listener($p, log, glob) {

  const {utils, job_prm, wsql, cat} = $p;
  const register = 'areg_dates';

  function notifyEvents({ref, class_name, number_doc, date, posted, _rev}, error) {
    const body = {ref, class_name, number_doc, date, posted, _rev};
    if(error) {
      body.error = error;
    }
    else {
      body.ok = true;
    }
    fetch(`http://localhost:${job_prm.server.port}/couchdb/events/post`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
      .catch((err) => null);
  }

  $p.md.once('planning_keys', ({subscription, accumulation}) => {
    const {client} = accumulation;
    glob.client = client;
    subscription.listeners.push(async function reflectPlaning({db, results, docs, branch, abonent, year}) {
      for(const {doc, prod} of docs) {
        try {
          // при любом изменении документа, удаляем старые записи
          await client.query(`DELETE FROM areg_dates where register = $1 and register_type = $2`, [doc.ref, doc.class_name]);
          if(doc.posted) {
            switch (doc.class_name) {
              case 'doc.calc_order':
                await calc_order({doc, client, utils, job_prm, wsql});
                break;
              case 'doc.work_centers_performance':
                await performance({doc, client, utils, job_prm, wsql});
                break;
              case 'doc.work_centers_task':
                await task({doc, client, utils, job_prm, cat});
                break;
              case 'doc.purchase_order':
                break;
            }
            // если документ проведён, добавляем новые
            // const sql = await nsql(doc, $p);
            // await client.query(sql);
          }
          await log.processing({doc, action: {posted: doc.posted}, register});
        }
        catch (error) {
          await log.processing({doc, action: {posted: doc.posted}, register, error});
          throw error;
        }
      }
    });
  });
}
