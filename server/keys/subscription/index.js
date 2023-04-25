
const limit = 120;
const states = 'Отправлен,Проверяется,Подтвержден,Отклонен,Отозван,Архив'.split(',');

class Subscription {

  constructor($p, log, accumulation) {

    this.$p = $p;
    this.log = log;
    this.accumulation = accumulation;
    this.reflect = require('./reflect')($p, log, accumulation);
    // интервал опроса и пересчета
    this.interval = 60000;
    // указатель на текущий таймер
    this.timer = 0;
    // базы всех отделов
    this.dbs = [];
    // новые базы, для которых seq не задан
    this.ndbs = [];
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
    const {$p: {cat: {abonents, branches}, job_prm: {server}}, accumulation, dbs} = this;
    const year = new Date().getFullYear();
    for(const branch of branches) {
      if(branch.use &&
          server.abonents.includes(branch.owner.id) &&
          (!server.branches.length || server.branches.includes(branch.suffix))) {
        const db = branch.db('doc');
        dbs.push(db);
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
        const db = abonent.db('doc');
        dbs.push(db);
        const since = await accumulation.get_param(`a|${abonent.ref}`);
        try{
          await this.read({db, since, branch: branches.get(), abonent, year});
        }
        catch (err) {
          this.log(err);
        }
      }
    }
    return Promise.resolve(this);
  }
}

// слушает базы всех отделов всех абонентов и создаёт по событиям, ключи
module.exports = function keys_subscription($p, log, accumulation) {
  accumulation.init()
    .then(() => {
      const subscription = new Subscription($p, log, accumulation);
      return subscription.subscribe();
    })
    .catch(log);
}