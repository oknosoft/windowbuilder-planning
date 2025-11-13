
class UsedSet extends Map {

  constructor(owner) {
    super();
    this.owner = owner;
    this.deferredVertexes = new Set();
  }

  add(date, shift, work_center, row) {
    if(!this.has(date)) {
      this.set(date, new Map());
    }
    const byDate = this.get(date);
    if(!byDate.has(shift)) {
      byDate.set(shift, new Map());
    }
    const byShift = byDate.get(shift);
    if(!byShift.has(work_center)) {
      byShift.set(work_center, []);
    }
    byShift.get(work_center).push(row);
  }

  totals(date, shift, work_center) {
    const byDate = this.get(date);
    if(byDate) {
      const byShift = byDate.get(shift);
      if(byShift) {
        const byWorkCenter = byShift.get(work_center);
        if(byWorkCenter) {
          return byWorkCenter.reduce((sum, curr) => sum + curr.power, 0);
        }
      }
    }
    return 0;
  }

  /**
   * @summary Выгружает набор данных в плоский массив
   * @param {CatWork_center_kinds} [stage]
   * @return {Array}
   */
  unload(stage) {
    const res = [];
    for(const [date, byDate] of this) {
      for(const [shift, byShift] of byDate) {
        for(const [work_center, byWorkCenter] of byShift) {
          for(const row of byWorkCenter) {
            if(!stage || row.stage === stage) {
              res.push({date, shift, work_center, ...row});
            }
          }
        }
      }
    }
    return res;
  }

  clear() {
    for(const [date, byDate] of this) {
      for(const [shift, byShift] of byDate) {
        byShift.clear();
      }
      byDate.clear();
    }
    super.clear();
  }

}

module.exports = UsedSet;
