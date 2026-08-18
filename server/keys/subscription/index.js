
const Couchdb = require('../couchdb');

const interval = 2000;    // интервал переподключения при ошибке

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
    const docs = await this._reflect(attr);
    for(const listener of this.listeners) {
      await listener.call(this, {...attr, docs});
    }
    for(const {doc} of docs) {
      doc.unload();
    }
  }

  async reconnect() {
    const {$p: {cat: {abonents}, job_prm: {server, user_node}, adapters: {pouch}}, accumulation, log} = this;
    const feed = server.feed ? new Couchdb(server.feed, {auth: user_node}) : pouch.remote.doc;
    const conf = {
      include_docs: true,
      since: await accumulation.get_param(`since|feed`)
        .catch(() => (''))
        .then((since) => since),
      selector: {type: 'doc.calc_order'},
    };
    if(!conf.since) {
      // "2026": {
      //   "8": "019f7e89-c86b-7cdf-b217-db0e638e08c1",
      //     "21": "019f7e97-85ba-7521-bdea-09da3e23f79c",
      //     "22": "019f80d3-413f-764f-97ba-5cf3880d82c6"
      // }
      conf.since =  '019f7e89-c86b-7cdf-b217-db0e638e08c1';
    }

    const onError = (e) => {
      log(e);
      changesFeed.cancel();
      setTimeout(this.reconnect.bind(this), interval);
    };

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
          await this.reflect({db: feed, results: [{doc}], branch, abonent, year: origin.year});
          await this.accumulation.set_param(`since|feed`, seq);
        }
        catch (e) {
          onError(e);
        }
      })
      .on('error', onError);
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
