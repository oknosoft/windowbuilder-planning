
const LinkedList = require('./LinkedList');

/**
 * Узел Графа
 */
class GraphVertex {
  /**
   * @param {String} value
   */
  constructor(value, point) {
    this.value = value;
    this.edges = new LinkedList(GraphVertex.edgeComparator);
    this.endEdges = new LinkedList(GraphVertex.edgeComparator);
    this.neighborsConverter = this.neighborsConverter.bind(this);
  }

  /**
   * @param {GraphEdge} edge
   * @returns {GraphVertex}
   */
  addEdge(edge) {
    this.edges.append(edge);
    return this;
  }

  addEndEdge(edge) {
    this.endEdges.append(edge);
    return this;
  }

  /**
   * @param {GraphEdge} edge
   */
  deleteEdge(edge) {
    this.edges.delete(edge);
    this.endEdges.delete(edge);
  }

  /**
   * @param {LinkedListNode} node
   */
  neighborsConverter(node) {
    return node.value.startVertex === this ? node.value.endVertex : node.value.startVertex;
  }

  /**
   * Вершины рёбер, исходящих из узла
   * Return either start or end vertex.
   * For undirected graphs it is possible that current vertex will be the end one.
   * @returns {GraphVertex[]}
   */
  getNeighbors() {
    return this.edges.toArray().map(this.neighborsConverter);
  }

  /**
   * Вершины рёбер, входящих в узел
   * @returns {GraphVertex[]}
   */
  getAncestors() {
    return this.endEdges.toArray().map(this.neighborsConverter);
  }

  /**
   * @return {GraphEdge[]}
   */
  getEdges() {
    return this.edges.toArray().map(({value}) => value);
  }

  /**
   * @return {GraphEdge[]}
   */
  getEndEdges() {
    return this.endEdges.toArray().map(({value}) => value);
  }

  /**
   * @return {GraphEdge[]}
   */
  getAllEdges() {
    return this.getEdges().concat(this.getEndEdges());
  }

  /**
   * @return {number}
   */
  getDegree() {
    return this.edges.toArray().length;
  }

  /**
   * @param {GraphEdge} requiredEdge
   * @return {boolean}
   */
  hasEdge(requiredEdge) {
    const edgeNode = this.edges.find({
      callback: edge => edge === requiredEdge,
    });

    return !!edgeNode;
  }

  /**
   * @param {GraphVertex} vertex
   * @return {boolean}
   */
  hasNeighbor(vertex) {
    const vertexNode = this.edges.find({
      callback: edge => edge.startVertex === vertex || edge.endVertex === vertex,
    });

    return !!vertexNode;
  }

  /**
   * @param {GraphVertex} vertex
   * @return {(GraphEdge|null)}
   */
  findEdge(vertex) {
    const callback = (edge) => edge.startVertex === vertex || edge.endVertex === vertex;
    const edge = this.edges.find({ callback });
    return edge ? edge.value : null;
  }

  /**
   * @type {string}
   */
  get key() {
    return this.value;
  }

  /**
   * @return {GraphVertex}
   */
  deleteAllEdges() {
    this.getEdges().forEach(edge => this.deleteEdge(edge));

    return this;
  }

  /**
   * Предыдущие этапы
   * @return {Set<any>}
   */
  get topStages() {
    const res = new Set();
    for(const prev of this.getEndEdges()) {
      res.add(prev.topStage);
    }
    return res;
  }

  /**
   * Следующие этапы
   * @return {Set<any>}
   */
  get nextStages() {
    const res = new Set();
    for(const next of this.getEdges()) {
      res.add(next.nextStage);
    }
    return res;
  }

  evalForward({demands, date, time, work_centers, used, startKey, force}) {
    // для всех рёбер, исходящих из текущего...
    for(const edge of this.getEdges()) {
      if(!edge.end) {
        if(edge.stage) {
          edge.evalForward({demands, date, time, work_centers, used, startKey});
        }
        else if(edge.composite && !force) {
          used.deferredEdges.set(edge, startKey);
        }
        else {
          edge.endVertex.evalForward({demands, date, time, work_centers, used, startKey});
        }
      }
    }
  }

  evalBackward({demands, date, time, work_centers, used, endKey, force}) {
    // для всех рёбер, завершающихся в текущем...
    const keyMap = new Map();
    for(const edge of this.getEndEdges()) {
      // для составных узлов, создаём новый стэк и помещаем на его вершину, запись предыдущего
      if(edge.composite) {
        const oldStack = used.stackMap.get(endKey);
        keyMap.set(edge, used.stackKey())
        const newStack = used.stackMap.get(keyMap.get(edge));
        if(oldStack.length) {
          newStack.push(oldStack[oldStack.length - 1]);
        }
      }
    }
    for(const edge of this.getEndEdges()) {
      if(edge.composite) {
        endKey = keyMap.get(edge);
      }
      if(edge.stage && !edge.end) {
        edge.evalBackward({demands, date, time, work_centers, used, endKey});
      }
      else if(edge.startComposite && !edge.start && !force) {
        used.deferredEdges.set(edge, endKey);
      }
      else {
        edge.startVertex.evalBackward({demands, date, time, work_centers, used, endKey});
      }
    }
  }

  /**
   * @param {function} [callback]
   * @return {string}
   */
  toString() {
    return `${this.value}`;
  }

  /**
   * @param {GraphEdge} edgeA
   * @param {GraphEdge} edgeB
   */
  static edgeComparator(edgeA, edgeB) {
    if (edgeA.key === edgeB.key) {
      return 0;
    }
    return edgeA.key < edgeB.key ? -1 : 1;
  }
}

module.exports = GraphVertex;

