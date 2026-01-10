

exports.CatWork_centersManager = class CatWork_centersManager extends Object {

  async loadRegister(client, {md, wsql: {alasql}, cat: {work_shifts}, enm: {planning_phases}, utils: {moment}}) {
    const pq = await client.query(`SELECT register, register_type, sign, phase,
      date, shift, work_center, planing_key, stage, calc_order, power, part, part_type FROM areg_dates where phase = 'plan' and date between $1 and $2`, [
      moment().add(-3, 'month').toDate(), // TODO: вернуть
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

  availableForward({stage, date, time, demand, used, startKey}) {
    const keys = typeof startKey === 'string' ? new Set([startKey]) : startKey;
    for(const work_center of this.register) {
      if(work_center.work_center_kinds.find({kind: stage})) {
        const selfDelay = work_center.delay();
        const dateShift = {date, time: time + selfDelay, jumpDelay: 0};
        for(const startKey of keys) {
          const stack = used.stackMap.get(startKey);
          let prev = stack.length && stack[stack.length - 1];
          if(prev?.stage === stage && stack.length > 1) {
            prev = stack[stack.length - 2];
          }
          if(prev && prev.stage !== stage && prev.work_center !== work_center) {
            const jumpDelay = prev.work_center.delay(work_center) || prev.work_center.delay(stage);
            if(jumpDelay && dateShift.jumpDelay < jumpDelay) {
              dateShift.jumpDelay = jumpDelay;
              dateShift.startKey = startKey;
            }
          }
        }
        if(dateShift.jumpDelay) {
          dateShift.time += dateShift.jumpDelay;
        }
        while (dateShift.time > 86400) {
          dateShift.date += 1;
          dateShift.time -= 86400;
        }
        // TODO: набрать массив доступных и выбрать оптимальный
        const available = work_center.register.firstForward({...dateShift, demand, used});
        if(available) {
          if(dateShift.startKey) {
            available.startKey = dateShift.startKey;
          }
          return available;
        }
      }
    }
  }

  availableBackward({stage, date, time, demand, used, endKey}) {
    const keys = typeof endKey === 'string' ? new Set([endKey]) : endKey;
    for(const work_center of this.register) {
      if(work_center.work_center_kinds.find({kind: stage})) {
        const dateShift = {date, time, jumpDelay: 0};
        for(const endKey of keys) {
          const stack = used.stackMap.get(endKey);
          let prev = stack.length && stack[stack.length - 1];
          if(prev?.stage === stage && stack.length > 1) {
            prev = stack[stack.length - 2];
          }
          if(prev && prev.stage !== stage && prev.work_center !== work_center) {
            const jumpDelay = work_center.delay(prev.work_center) || work_center.delay(stage);
            if(jumpDelay && dateShift.jumpDelay < jumpDelay) {
              dateShift.jumpDelay = jumpDelay;
              dateShift.endKey = endKey;
            }
          }
        }
        // while (delay > 86400) {
        //   dateShift.date -= 1;
        //   delay -= 86400;
        // }
        if(dateShift.jumpDelay) {
          //dateShift.time -= dateShift.jumpDelay;
        }
        // TODO: набрать массив доступных и выбрать оптимальный (доступен позже и время перехода меньше)
        const available = work_center.register.firstBackward({...dateShift, demand, used});
        if(available) {
          if(dateShift.endKey) {
            available.endKey = dateShift.endKey;
          }
          available.delay = work_center.delay() + dateShift.jumpDelay;

          return available;
        }
      }
    }
  }
  //static _replace = true;
}

exports.CatWork_centers = class CatWork_centers extends Object {

  delay(recipient) {
    if(!recipient) {
      recipient = this;
    }
    return this.time_standard.find({recipient})?.event_time || 0;
  }
}
