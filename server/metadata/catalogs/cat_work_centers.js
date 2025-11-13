

exports.CatWork_centersManager = class CatWork_centersManager extends Object {

  async loadRegister(client, {md, wsql: {alasql}, cat: {work_shifts}, enm: {planning_phases}, utils: {moment}}) {
    const pq = await client.query(`SELECT register, register_type, sign, phase,
      date, shift, work_center, planing_key, stage, calc_order, power, part, part_type FROM areg_dates where phase = 'plan' and date between $1 and $2`, [
      moment().add(-1, 'month').toDate(),
      moment().add(1, 'month').toDate(),
    ]);

    // создадим хранилища
    for(const work_center of this) {
      work_center.register = new this.constructor.RowsFragment(work_center);
    }
    for(let {work_center, ...other} of pq.rows) {
      this.get(work_center).register.add(other);
    }
    // this.get('217d4006-1790-11eb-80cb-dff6ed303e34').register.reminders(planning_phases.plan);

  }

  availableForward({stage, date, demand, used}) {
    for(const work_center of this) {
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
