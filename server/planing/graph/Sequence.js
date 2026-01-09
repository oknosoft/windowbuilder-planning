
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
      this.getVertex('0').evalForward({demands: fragment, date, time: 0, work_centers, used});
      while (used.deferredEdges.size) {
        const deferred= Array.from(used.deferredEdges);
        used.deferredEdges.clear();
        const vertexes = new Map();
        for(const [edge, startKey] of deferred) {
          const stack = used.stackMap.get(startKey);
          if(!vertexes.has(edge.endVertex)) {
            vertexes.set(edge.endVertex, {startKey: new Set()});
          }
          const patch = vertexes.get(edge.endVertex);
          patch.startKey.add(startKey);
          const last = stack[stack.length - 1];
          if(!patch.date || patch.date < last.date) {
            patch.date = last.date;
            patch.time = last.start;
          }
        }
        for(const [vertex, patch] of vertexes) {
          vertex.evalForward({demands: fragment, ...patch, work_centers, used, force: true});
        }
      }
    }
    const forwardRows = used.unload();
    const forwardGrouped = alasql(`select work_center, date, shift, sum(power) power from ? group by work_center, date, shift`, [forwardRows]);
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
    return {maxDate, forwardGrouped, forwardRows};
  }

  evalBackward({demands, doc, alasql, work_centers, date}) {
    const used = new UsedSet(this);
    for(const {obj, specimen} of alasql(`select distinct obj, specimen from ?`, [demands])) {
      const fragment = demands.filter(v => v.obj === obj && v.specimen === specimen);
      this.getVertex('end').evalBackward({demands: fragment, date, work_centers, used});
      while (used.deferredEdges.size) {
        const deferred= Array.from(used.deferredEdges);
        used.deferredEdges.clear();
        for(const vertex of deferred) {
          const patch = {}
          for(const stage of vertex.nextStages) {
            for(const row of used.unload(stage)) {
              if(!patch.date || patch.date > row.date) {
                patch.date = row.date;
              }
            }
          }
          vertex.evalBackward({demands: fragment, date: patch.date || date, work_centers, used, force: true});
        }
      }
    }
    const backwardRows = used.unload();
    const backwardGrouped = alasql(`select work_center, date, shift, sum(power) power from ? group by work_center, date, shift`, [backwardRows]);
    used.clear();
    let minDate = Infinity;
    for(const row of backwardRows) {
      if(row.date < minDate) {
        minDate = row.date;
      }
      const date = row.date.toFixed();
      row.date = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
      row.work_center = row.work_center.ref;
      row.shift = row.shift.ref;
      row.stage = row.stage.ref;
    }
    return {minDate, backwardGrouped, backwardRows};
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
    const {maxDate, forwardGrouped, forwardRows} = this.evalForward({demands, doc, work_centers, alasql});

    // пытаемся подтянуть найденные ближайшие к дате финала, чтобы уменьшить остатки на переделах
    let backwardRes = {};
    try {
      backwardRes = this.evalBackward({demands, doc, work_centers, alasql, date: maxDate});
    }
    catch (e) {
      // если не уместилось в обратную сторону, можем поискать другие даты
      e.log;
    }
    const {minDate, backwardGrouped, backwardRows} = backwardRes;

    const phase = 'plan';
    const sign = -1;
    const register = doc.ref;
    const register_type = doc.class_name;
    for(const {work_center, date, shift, power} of backwardRows?.length ? backwardGrouped : forwardGrouped) {
      work_center.register.add({date, shift, phase, register_type, register, power, sign});
    }

    return backwardRows?.length ? backwardRows : forwardRows;
  }
}

module.exports = StagesSequence;
