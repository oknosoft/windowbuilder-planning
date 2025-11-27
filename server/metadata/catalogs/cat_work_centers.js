

exports.CatWork_centersManager = class CatWork_centersManager extends Object {

  async loadRegister(client, {md, wsql: {alasql}, cat: {work_shifts}, enm: {planning_phases}, utils: {moment}}) {
    const pq = await client.query(`SELECT register, register_type, sign, phase,
      date, shift, work_center, planing_key, stage, calc_order, power, part, part_type FROM areg_dates where phase = 'plan' and date between $1 and $2`, [
      moment().add(-1, 'month').toDate(),
      moment().add(1, 'month').toDate(),
    ]);

    this.register = new Set();

    // создадим и наполним хранилища
    for(let {work_center: ref, ...other} of pq.rows) {
      const work_center = this.get(ref);
      if(!work_center.register) {
        work_center.register = new this.constructor.RowsFragment(work_center);
        this.register.add(work_center);
      }
      work_center.register.add(other);
    }
    // this.get('217d4006-1790-11eb-80cb-dff6ed303e34').register.reminders(planning_phases.plan);

  }

  clearRegister(register, register_type) {
    for(const work_center of this.register) {
      work_center.register.clear(register, register_type);
    }
  }

  availableForward({stage, date, demand, used}) {
    for(const work_center of this.register) {
      if(work_center.work_center_kinds.find({kind: stage})) {
        const available = work_center.register.firstForward({date, demand, used});
        if(available) {
          return available;
        }
      }
    }
  }
  //static _replace = true;
}
