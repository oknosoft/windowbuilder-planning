
exports.CatProduction_kinds = class CatProduction_kinds extends Object {

  /**
   * @summary Массив всех этапов, возможных в данном виде производства
   * @type {Array.<CatWork_center_kinds>}
   */
  get allStages() {
    let res = new Set();
    for(const {stage} of this.stages) {
      if(stage instanceof this.constructor) {
        for(const sub of stage.allStages) {
          res.add(sub);
        }
      }
      else if(stage) {
        res.add(stage);
      }
    }
    return Array.from(res);
  }

  /**
   * @summary Ищет предыдущий узел с учётом потребности в этапах
   * @desc Вспомогательная функция для sequence
   * @param {String} parent
   * @param {Set.<CatWork_center_kinds>} stages
   * @return {String}
   */
  findTop(parent, stages) {
    if(!parent) {
      return '0';
    }
    if(parent.includes(',')) {
      let parents = parent.split(',')
        .map(v => this.findTop(v, stages))
        .filter(v => v !== '0');
      if(!parents.length) {
        return '0';
      }
      parents = Array.from(new Set(parents));
      if(parents.length === 1) {
        return parents[0];
      }
      return parents.join(',');
    }
    const row = this.stages.get(parseInt(parent) - 1);
    const {stage} =row;
    if(stage instanceof this.constructor || stages.has(stage)) {
      return parent;
    }
    return this.findTop(row.parent, stages);
  }

  /**
   * @summary Граф последовательности этапов
   * @param {Set.<CatWork_center_kinds>} stages - этапы текущей продукции или фрагмента
   * @return {Graph}
   */
  sequence(stages) {
    const res = new this.constructor.StagesSequence(this);
    for(const {stage, parent, row} of this.stages) {
      if(stage instanceof this.constructor) {
        const edges = stage.sequence(stages).getAllEdges();
        if(edges.length) {
          const top = this.findTop(parent, stages);
          for(const subEdge of edges) {
            const startVertex = subEdge.startVertex.key === '0' ? res.addVertex(top) : res.addVertex(`${row.toFixed()}.${subEdge.startVertex.key}`);
            const endVertex = subEdge.endVertex.key === 'end' ? res.addVertex(row.toFixed()) : res.addVertex(`${row.toFixed()}.${subEdge.endVertex.key}`);
            const edge = res.addEdge(startVertex, endVertex, subEdge.stage?.end ? null : subEdge.stage);
          }
        }
      }
      else  {
        const real = stage.end || stages.has(stage);
        if(real) {
          const top = this.findTop(parent, stages);
          const startVertex = res.addVertex(top);
          const endVertex = stage.end ? res.getVertex('end') : res.addVertex(row.toFixed());
          const edge = res.addEdge(startVertex, endVertex, stage);
          if(top.includes(',')) {
            for(const part of top.split(',')) {
              const partVertex = res.addVertex(part);
              if(!res.findEdge(partVertex, startVertex)) {
                res.addEdge(partVertex, startVertex, null);
              }
            }
          }
        }
      }
    }
    return res;
  }
}
