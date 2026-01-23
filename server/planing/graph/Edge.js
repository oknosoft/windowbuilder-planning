/**
 * Ребро графа
 */
class GraphEdge {
  /**
   * @param {GraphVertex} startVertex
   * @param {GraphVertex} endVertex
   * @param {CatWork_center_kinds} stage
   */
  constructor(startVertex, endVertex, stage) {
    this.startVertex = startVertex;
    this.endVertex = endVertex;
    this.stage = stage;
  }

  evalForward({demands, date, time, work_centers, used, startKey}) {
    const {stage} = this;
    if(!startKey) {
      startKey = used.stackKey();
    }
    let stack;
    for(const {planing_key, totqty: power} of demands.filter(v => v.stage == stage)) {
      if(power) {
        const available = work_centers.availableForward({stage, date, time, demand: power, used, startKey});
        if(available) {
          used.add(available.date, available.shift, available.work_center, {planing_key, stage, time: available.start, power});
          // если есть предыдущий, добавим время предыдущего и время перехода
          stack = used.stackMap.get(available.startKey || startKey);
          if(!stack.length || stack[stack.length - 1].stage !== stage) {
            stack.push({stage, ...available});
          }
          else {
            Object.assign(stack[stack.length - 1], available);
          }
        }
        else {
          throw new Error(`Не хватает мощности для этапа: '${stage.name}', дата начала: ${date}, потребность: ${power}`);
        }
      }
    }
    if(stack) {
      const last = stack[stack.length - 1];
      this.endVertex.evalForward({demands, date : last.date, time: last.start, work_centers, used, startKey: last.startKey || startKey});
    }
  }

  evalBackward({demands, date, time, work_centers, used, endKey}) {
    const {stage} = this;
    let stack;
    for(const {planing_key, totqty: power} of demands.filter(v => v.stage == stage)) {
      if(power) {
        const available = work_centers.availableBackward({stage, date, time, demand: power, used, endKey});
        if(available) {
          used.add(available.date, available.shift, available.work_center, {planing_key, stage, time: available.start, power});
          // если есть предыдущий, добавим время предыдущего и время перехода
          stack = used.stackMap.get(available.endKey || endKey);
          if(!stack.length || stack[stack.length - 1].stage !== stage) {
            stack.push({stage, ...available});
          }
          else {
            Object.assign(stack[stack.length - 1], available);
          }
        }
        else {
          throw new Error(`Не хватает мощности для этапа: '${stage.name}', дата финала: ${date}, потребность: ${power}`);
        }
      }
    }
    if(stack) {
      const last = stack[stack.length - 1];
      this.startVertex.evalBackward({demands, date: last.date, time: last.fin, work_centers, used, endKey});
    }
  }

  get topStage() {
    if(this.stage) {
      return this.stage;
    }
    for(const prev of this.startVertex.getEndEdges()) {
      const {topStage} = prev;
      if(topStage) {
        return topStage;
      }
    }
  }

  get nextStage() {
    if(this.stage) {
      return this.stage;
    }
    for(const next of this.endVertex.getEdges()) {
      const {nextStage} = next;
      if(nextStage) {
        return nextStage;
      }
    }
  }

  /**
   * @type {string}
   */
  get key() {
    const {startVertex, endVertex} = this;
    return `${startVertex.key}-${endVertex.key}`;
  }

  get end() {
    return this.endVertex.key === 'end';
  }

  get start() {
    return this.startVertex.key === '0';
  }

  get composite() {
    return this.endVertex.getEndEdges().length > 1;
  }

  get startComposite() {
    return this.startVertex.getEndEdges().length > 1;
  }

  /**
   * @return {GraphEdge}
   */
  reverse() {
    const tmp = this.startVertex;
    this.startVertex = this.endVertex;
    this.endVertex = tmp;
    return this;
  }

  /**
   * @return {string}
   */
  toString() {
    return this.key;
  }
}

module.exports = GraphEdge;

