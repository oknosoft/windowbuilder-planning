
const limit = 100;        // объектов за такт
const interval = 2000;    // интервал переподключения при ошибке
const heartbeat = 20000;  // параметр http для оживления соединения
const states = 'Отправлен,Проверяется,Подтвержден,Отклонен,Отозван,Архив'.split(',');

class Subscription {

  constructor($p, log, accumulation) {

    this.$p = $p;
    this.log = log;
    this.accumulation = accumulation;
    // внешние подписчики, могут поместить сюда свои методы для расчёта своих индексов
    this.listeners = [];
    this._reflect = require('./reflect')($p, log, accumulation);
  }

  async reflect(attr) {
    let {prm, last_seq, docs} = await this._reflect(attr);
    for(const listener of this.listeners) {
      await listener.call(this, {...attr, docs});
    }
    for(const {doc, prod} of docs) {
      for(const ox of prod) {
        ox.unload();
      }
      doc.unload();
    }
    this.accumulation.set_param(prm, last_seq);
  }

  async reconnect(abonent) {
    const {$p: {cat: {branches}, job_prm: {server}, adapters: {pouch}}, accumulation, log} = this;
    const branch = branches.get()
    const db = server.single_db ? pouch.remote.doc : abonent.db('doc');
    const year = new Date().getFullYear();
    const conf = {
      include_docs: true,
      heartbeat,
      limit,
      since: await accumulation.get_param(`a|${abonent.ref}`)
        .catch(() => (''))
        .then((since) => since),
      selector: {class_name: 'doc.calc_order', obj_delivery_state: {$in: states}}
    };

    return db.changes(conf)
      .then(async ({results, last_seq}) => {
        if(results.length) {
          await this.reflect({db, results, last_seq, branch, abonent, year});
          return await this.reconnect(abonent);
        }
        conf.live = true;
        conf.batch_size = limit;
        delete conf.limit;
        log(`planning_keys reconnect zone=${abonent.id} since=${conf.since.split('-')[0]}`);
        return db.changes(conf)
          .on('change', async ({seq, doc}) => {
            await this.reflect({db, last_seq: seq, results: [doc], branch, abonent, year});
          })
          .on('error', (error) => {
            log(error);
            setTimeout(this.reconnect.bind(this, abonent), interval);
          });
      });
  }

  async subscribe() {
    const {cat: {abonents}, job_prm: {server, zone}} = this.$p;
    for(const id of server.single_db ? [zone] : server.abonents) {
      await this.reconnect(abonents.by_id(id));
    }
    return Promise.resolve(this);
  }
}

// слушает базы всех отделов всех абонентов и создаёт по событиям, ключи
module.exports = function keys_subscription($p, log, accumulation) {
  return accumulation
    .init()
    .then(() => {
      const subscription = new Subscription($p, log, accumulation);
      $p.md.emit('planning_keys', {subscription, accumulation});
      return subscription.subscribe();
    })
    .catch(log);
}
