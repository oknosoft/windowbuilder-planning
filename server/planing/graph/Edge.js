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
    for(const demand of demands.filter(v => v.stage == stage)) {
      const {planing_key, totqty: power} = demand;
      if(power) {
        const available = work_centers.availableForward({stage, date, time, demand: power, used, startKey});
        if(available) {
          used.add(available.date, available.shift, available.work_center, {planing_key, stage, time: available.start, power});
          // если есть предыдущий, добавим время предыдущего и время перехода
          const stack = used.stackMap.get(available.startKey || startKey);
          if(!stack.length || stack[stack.length - 1].stage !== stage) {
            stack.push({stage, ...available});
          }
          else {
            Object.assign(stack[stack.length - 1], available);
          }
          this.endVertex.evalForward({demands, date : available.date, time: available.start, work_centers, used, startKey});
        }
        else {
          throw new Error(`Не хватает мощности для этапа: '${stage.name}', дата начала: ${date}, потребность: ${power}`);
        }
      }
    }
  }

  evalBackward({demands, date, work_centers, used}) {
    const {stage} = this;
    for(const demand of demands.filter(v => v.stage == stage)) {
      const {planing_key, totqty: power} = demand;
      if(power) {
        const available = work_centers.availableBackward({stage, date, demand: power, used});
        if(available) {
          used.add(available.date, available.shift, available.work_center, {planing_key, stage, time: available.time, power});
          this.startVertex.evalBackward({demands, date: available.date, work_centers, used});
        }
        else {
          throw new Error(`Не хватает мощности для этапа: '${stage.name}', дата финала: ${date}, потребность: ${power}`);
        }
      }
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

