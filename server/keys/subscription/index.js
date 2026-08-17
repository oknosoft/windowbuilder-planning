
const Couchdb = require('../couchdb');

const interval = 2000;    // интервал переподключения при ошибке
const states = 'Отправлен,Проверяется,Подтвержден,Отклонен,Отозван,Архив'.split(',');
const class_names = [
  'doc.work_centers_performance',
  'doc.work_centers_task',
  'doc.purchase_order',
  'doc.planning_event',
  'doc.inventory_cuts',
];

class Subscription {

  constructor($p, log, accumulation) {

    this.$p = $p;
    this.log = log;
    this.accumulation = accumulation;
    this.logged = {};
    // внешние подписчики, могут поместить сюда свои методы для расчёта своих индексов
    this.listeners = [];
    this._reflect = require('./reflect')($p, log, accumulation);
  }

  async reflect(attr) {
    let {prm, last_seq, docs} = await this._reflect(attr);
    for(const listener of this.listeners) {
      await listener.call(this, {...attr, docs});
    }
    for(const {doc} of docs) {
      doc.unload();
    }
  }

  async reconnect() {
    const {$p: {cat: {abonents}, job_prm: {server}, adapters: {pouch}}, accumulation, log} = this;
    const feed = server.feed ? new Couchdb(server.feed, {auth: user_node}) : pouch.remote.doc;
    const conf = {
      include_docs: true,
      since: await accumulation.get_param(`since|feed`)
        .catch(() => (''))
        .then((since) => since),
      selector: {class_name: 'doc.calc_order'},
    };
    if(!conf.since) {
      conf.selector.year =  new Date().getFullYear();
    }

    return new Promise((resolve, reject) => {
      const changesFeed = feed.changes(conf)
        .on('change', async ({seq, doc, origin}) => {
          //{year, abonent, branch}
          const abonent = abonents.by_id(origin.abonent);
          const branch = abonent.branch(origin.branch);
          try {
            if(!this.logged.feed) {
              log(`planning_keys reconnect feed zone=${abonent.id} since=${seq}`);
              this.logged.feed = true;
            }
            await this.reflect({db: feed, last_seq: seq, results: [{doc}], branch, abonent, year: origin.year});
            this.accumulation.set_param(`since|feed`, seq);
          }
          catch (e) {
            log(e);
          }
        })
        .on('error', (e) => {
          log(e);
          changesFeed.cancel();
          setTimeout(this.reconnect.bind(this), interval);
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
      return subscription.reconnect();
    })
    .catch(log);
}
