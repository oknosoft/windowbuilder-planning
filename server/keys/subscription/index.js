
const limit = 120;  // объектов за такт
this.interval = 2000;       // интервал опроса и пересчета
const states = 'Отправлен,Проверяется,Подтвержден,Отклонен,Отозван,Архив'.split(',');

class Subscription {

  constructor($p, log, accumulation) {

    this.$p = $p;
    this.log = log;
    this.accumulation = accumulation;
    // внешние подписчики, могут поместить сюда свои методы для расчёта своих индексов
    this.listeners = [];
    this._reflect = require('./reflect')($p, log, accumulation);

    // указатель на текущий таймер
    this.timer = 0;
    // базы всех отделов
    this.dbs = [];
    // новые базы, для которых seq не задан
    this.ndbs = [];
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

  read({db, since = '', branch, abonent, year}) {
    return db.changes({
      since,
      limit,
      include_docs: true,
      selector: {class_name: 'doc.calc_order', obj_delivery_state: {$in: states}}
    })
      .then(({results, last_seq}) => {
        return results.length ?
          this.reflect({db, results, last_seq, branch, abonent, year})
            .then(() => this.read({db, since: last_seq, branch, abonent, year}))
          :
          last_seq;
      });
  }

  async subscribe() {
    const {$p: {cat: {abonents, branches}, job_prm: {server}}, accumulation, dbs, interval, timer} = this;
    const year = new Date().getFullYear();
    clearTimeout(timer);

    for(const branch of branches) {
      if(branch.use &&
        server.abonents.includes(branch.owner.id) &&
        (!server.branches.length || server.branches.includes(branch.suffix))) {
        const db = branch.db('doc');
        !dbs.includes(db) && dbs.push(db);
        const since = await accumulation.get_param(`b|${branch.ref}`) || '';
        try{
          await this.read({db, since, branch, abonent: branch.owner, year});
        }
        catch (err) {
          this.log(err);
        }
      }
    }
    for(const abonent of abonents) {
      if(server.abonents.includes(abonent.id)) {
        const {job_prm: {server}, adapters: {pouch}} = this.$p;
        const db = server.single_db ? pouch.remote.doc : abonent.db('doc');
        !dbs.includes(db) && dbs.push(db);
        const since = await accumulation.get_param(`a|${abonent.ref}`);
        try{
          await this.read({db, since, branch: branches.get(), abonent, year});
        }
        catch (err) {
          this.log(err);
        }
      }
    }

    setTimeout(this.subscribe.bind(this), interval);
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
