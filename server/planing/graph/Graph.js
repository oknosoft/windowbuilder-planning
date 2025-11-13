// https://github.com/trekhleb/javascript-algorithms
const GraphVertex = require('./Vertex');

class Graph {
  /**
   * @param {Object} owner
   */
  constructor(owner) {
    this.vertices = {};
    this.edges = {};
    this.isDirected = true;
    this.owner = owner;
    this.cache = new Map();
  }

  /**
   * Чистит граф
   */
  clear() {
    this.cache.clear();
    for(const edge of this.getAllEdges().reverse()) {
      this.deleteEdge(edge);
    }
    for(const vertex of this.getAllVertices()) {
      this.deleteVertex(vertex);
    }
  }

  /**
   * @param {GraphVertex|String} newVertex
   * @return {Graph}
   */
  addVertex(newVertex) {
    if(typeof newVertex === 'string') {
      newVertex = this.getVertex(newVertex) || new GraphVertex(newVertex);
    }
    this.vertices[newVertex.key] = newVertex;
    return newVertex;
  }

  /**
   * @param {string} key
   * @return GraphVertex
   */
  getVertex(key) {
    return this.vertices[key];
  }

  /**
   * @param {GraphVertex} vertex
   * @return {GraphVertex[]}
   */
  getNeighbors(vertex) {
    return vertex.getNeighbors();
  }

  /**
   * @return {GraphVertex[]}
   */
  getAllVertices() {
    return Object.values(this.vertices);
  }

  /**
   * @param {GraphVertex} vertex
   * @return {Graph}
   */
  deleteVertex(vertex) {
    delete this.vertices[vertex.key];
    return this;
  }

  /**
   * @return {GraphEdge[]}
   */
  getAllEdges() {
    return Object.values(this.edges);
  }

  /**
   * @param {GraphEdge} edge
   * @return {Graph}
   */
  addEdge(edge) {
    // Try to find and end start vertices.
    let startVertex = this.getVertex(edge.startVertex.key);
    let endVertex = this.getVertex(edge.endVertex.key);

    // Insert start vertex if it wasn't inserted.
    if (!startVertex) {
      this.addVertex(edge.startVertex);
      startVertex = this.getVertex(edge.startVertex.key);
    }

    // Insert end vertex if it wasn't inserted.
    if (!endVertex) {
      this.addVertex(edge.endVertex);
      endVertex = this.getVertex(edge.endVertex.key);
    }

    // Check if edge has been already added.
    if (this.edges[edge.key]) {
      throw new Error('Edge has already been added before');
    }
    else {
      this.edges[edge.key] = edge;
    }

    // Add edge to the vertices.
    startVertex.addEdge(edge);
    endVertex.addEndEdge(edge);
    if (!this.isDirected) {
      // If graph IS directed then add the edge only to start vertex.
      endVertex.addEdge(edge);
      startVertex.addEndEdge(edge);
    }

    return this;
  }

  /**
   * @param {GraphEdge} edge
   */
  deleteEdge(edge) {
    // Delete edge from the list of edges.
    delete this.edges[edge.key];

    // Try to find and end start vertices and delete edge from them.
    const startVertex = this.getVertex(edge.startVertex.key);
    const endVertex = this.getVertex(edge.endVertex.key);

    startVertex.deleteEdge(edge);
    endVertex.deleteEdge(edge);
    this.cache.delete(edge);

  }

  /**
   * @param {GraphVertex} startVertex
   * @param {GraphVertex} endVertex
   * @return {(GraphEdge|null)}
   */
  findEdge(startVertex, endVertex) {
    const vertex = this.getVertex(startVertex.key);
    if (!vertex) {
      return null;
    }
    return vertex.findEdge(endVertex);
  }

  /**
   * @return {number}
   */
  getWeight() {
    return this.getAllEdges().reduce((weight, graphEdge) => {
      return weight + graphEdge.weight;
    }, 0);
  }

  /**
   * @return {object}
   */
  getVerticesIndices() {
    const verticesIndices = {};
    this.getAllVertices().forEach((vertex, index) => {
      verticesIndices[vertex.key] = index;
    });

    return verticesIndices;
  }

  /**
   * @return {*[][]}
   */
  getAdjacencyMatrix() {
    const vertices = this.getAllVertices();
    const verticesIndices = this.getVerticesIndices();

    // Init matrix with infinities meaning that there is no ways of
    // getting from one vertex to another yet.
    const adjacencyMatrix = Array(vertices.length).fill(null).map(() => {
      return Array(vertices.length).fill(Infinity);
    });

    // Fill the columns.
    vertices.forEach((vertex, vertexIndex) => {
      vertex.getNeighbors().forEach((neighbor) => {
        const neighborIndex = verticesIndices[neighbor.key];
        adjacencyMatrix[vertexIndex][neighborIndex] = this.findEdge(vertex, neighbor).weight;
      });
    });

    return adjacencyMatrix;
  }

  /**
   * @return {string}
   */
  toString() {
    return Object.keys(this.vertices).toString();
  }

}

module.exports = Graph;
