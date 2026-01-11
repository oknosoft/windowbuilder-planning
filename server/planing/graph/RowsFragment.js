

module.exports = function ({md, wsql: {alasql}, cat: {work_shifts}, enm: {planning_phases}, utils: {moment}}) {

  const reminders = alasql.compile('select date, start, fin, shift, sum(power) power, sum(case when power > 0 then power else 0 end) debit from ? group by date, start, fin, shift order by date, start');

  class RowsFragment {

    constructor(owner) {
      this.owner = owner;
      this.byPhase = new Map();
    }

    static fetchDate(date) {
      if(date instanceof Date) {
        date = date.toJSON();
      }
      if(typeof date === 'string') {
        return parseInt(date.substring(0,10).replace(/-/g, ''));
      }
      return date;
    }

    add({date, shift, phase, register_type, part_type, power, sign, ...other}) {
      const {byPhase} = this;
      phase = planning_phases.get(phase);
      if(!byPhase.has(phase)) {
        byPhase.set(phase, []);
      }
      shift = work_shifts.get(shift);
      byPhase.get(phase).push(Object.assign(other, {
        date: RowsFragment.fetchDate(date),
        shift,
        start: shift.timeOrder,
        fin: shift.timeOrder + shift.duration,
        register_type: md.mgr_by_class_name(register_type),
        part_type: part_type && md.mgr_by_class_name(part_type),
        power: sign * parseFloat(power),
      }));
    }

    clear(register, register_type) {
      for(const [phase, rows] of this.byPhase) {
        const rm = rows.filter(v => v.register_type === register_type && v.register === register);
        for(const row of rm) {
          rows.splice(rows.indexOf(row), 1);
        }
      }
    }

    reminders(phase, date, shift) {
      let rows = this.byPhase.get(phase) || [];
      if(date) {
        rows = rows.filter(v => v.date === date);
      }
      if(shift) {
        rows = rows.filter(v => v.shift === shift);
      }
      const res = reminders([rows]);
      return res;
    }

    firstForward({phase, date, time, demand, used}) {
      if(!phase) {
        phase = planning_phases.plan;
      }
      const {byPhase, owner: work_center} = this;
      // TODO: можно оптимизировать пачку
      const rows = byPhase.get(phase)?.filter(v =>
        v.date > date || (v.date == date && (!time || v.start <= time && v.fin >= time))) || [];
      for(const {date, start, fin, shift, power} of reminders([rows])) {
        if(power >= demand && (power >= demand + used.totals(date, shift, work_center))) {
          return {work_center, date, start, fin, shift};
        }
      }
    }

    firstBackward({phase, date, time, demand, used}) {
      if(!phase) {
        phase = planning_phases.plan;
      }
      const {byPhase, owner: work_center} = this;
      // TODO: можно оптимизировать пачку
      const rows = byPhase.get(phase)?.filter(v =>
        v.date < date || (v.date === date && (!time || v.start <= time && v.fin >= time))) || [];
      for(const {date, start, fin, shift, power} of reminders([rows]).reverse()) {
        if(power >= demand && (power >= demand + used.totals(date, shift, work_center))) {
          return {work_center, date, start, fin, shift};
        }
      }
    }
  }

  return RowsFragment;
};
