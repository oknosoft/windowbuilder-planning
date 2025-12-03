
const Graph = require('./Graph');
const GraphEdge = require('./Edge');
const GraphVertex = require('./Vertex');
const UsedSet = require('./UsedSet');

class StagesSequence extends Graph {
  constructor(owner) {
    super(owner);
    // предопределённые узлы начала и окончания, добавляем сразу
    this.addVertex(new GraphVertex('0'));
    this.addVertex(new GraphVertex('end'));
  }

  addEdge(startVertex, endVertex, stage) {
    const edge = new GraphEdge(startVertex, endVertex, stage);
    super.addEdge(edge);
    return edge;
  }

  evalForward({demands, doc, alasql, work_centers}) {
    const used = new UsedSet(this);
    const date = work_centers.constructor.RowsFragment.fetchDate(doc.date);
    for(const {obj, specimen} of alasql(`select distinct obj, specimen from ?`, [demands])) {
      const fragment = demands.filter(v => v.obj === obj && v.specimen === specimen);
      this.getVertex('0').evalForward({demands: fragment, date, work_centers, used});
      while (used.deferredVertexes.size) {
        const deferred= Array.from(used.deferredVertexes);
        used.deferredVertexes.clear();
        for(const vertex of deferred) {
          const patch = {}
          for(const stage of vertex.topStages) {
            for(const row of used.unload(stage)) {
              if(!patch.date || patch.date < row.date) {
                patch.date = row.date;
              }
            }
          }
          vertex.evalForward({demands: fragment, date: patch.date || date, work_centers, used, force: true});
        }
      }
    }
    const forwardRows = used.unload();
    const grouped = alasql(`select work_center, date, shift, sum(power) power from ? group by work_center, date, shift`, [forwardRows]);
    const phase = 'plan';
    const sign = -1;
    const register = doc.ref;
    const register_type = doc.class_name;
    for(const {work_center, date, shift, power} of grouped) {
      work_center.register.add({date, shift, phase, register_type, register, power, sign});
    }
    used.clear();
    let maxDate = 0;
    for(const row of forwardRows) {
      if(row.date > maxDate) {
        maxDate = row.date;
      }
      const date = row.date.toFixed();
      row.date = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
      row.work_center = row.work_center.ref;
      row.shift = row.shift.ref;
      row.stage = row.stage.ref;
    }
    return {maxDate, forwardRows};
  }

  evalBackward({demands, alasql, work_centers, date}) {
    const used = new UsedSet(this);
    for(const {obj, specimen} of alasql(`select distinct obj, specimen from ?`, [demands])) {
      const fragment = demands.filter(v => v.obj === obj && v.specimen === specimen);
      this.getVertex('end').evalForward({demands: fragment, date, work_centers, used});
      while (used.deferredVertexes.size) {
        const deferred= Array.from(used.deferredVertexes);
        used.deferredVertexes.clear();
        for(const vertex of deferred) {
          const patch = {}
          for(const stage of vertex.topStages) {
            for(const row of used.unload(stage)) {
              if(!patch.date || patch.date < row.date) {
                patch.date = row.date;
              }
            }
          }
          vertex.evalForward({demands: fragment, date: patch.date || date, work_centers, used, force: true});
        }
      }
    }
  }

  evaluate({demands, doc, wsql}) {
    const {owner} = this;
    const {work_centers} = owner._manager._owner;
    const {alasql} = wsql;
    // решаем задачу для текущего вида производства, потребности других видов - отбрасываем
    demands = demands.filter(v => v.production_kind === owner);

    // если в заказе указана дата отгрузки или доставки, сразу решаем evalBackward
    // строго говоря, дату могли указать для этапа в середине, тогда надо решать в обе стороны

    // ищем ближайшие
    const {maxDate, forwardRows} = this.evalForward({demands, doc, work_centers, alasql});

    // пытаемся подтянуть найденные ближайшие к дате финала, чтобы уменьшить остатки на переделах
    try {
      const {minDate, backwardRows} = this.evalBackward({demands, doc, work_centers, alasql, date: maxDate});
    }
    catch (e) {
      // если не уместилось в обратную сторону, можем поискать другие даты
    }

    return forwardRows;
  }
}

module.exports = StagesSequence;
