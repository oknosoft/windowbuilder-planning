
//const planning = require('./planing');
const keys = require('./keys');
const needs = require('./needs');

module.exports = function planning($p, log, route) {
  keys($p, log, route);
  needs($p, log, route);
}
