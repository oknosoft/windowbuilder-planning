
class UsedSet extends Map {

  constructor(owner) {
    super();
    this.owner = owner;
    this.deferredEdges = new Map();
    this.stackMap = new Map();
    this.stackOrder = [];
  }

  stackKey() {
    const key = this.owner.owner._manager._owner.$p.utils.generate_guid();
    this.stackOrder.push(key);
    this.stackMap.set(key, []);
    return key;
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
    this.deferredEdges.clear();
    this.stackMap.clear();
    this.stackOrder.length = 0;
    super.clear();
  }

}

module.exports = UsedSet;
