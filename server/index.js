
//const planning = require('./planing');
const keys = require('./keys');
const needs = require('./needs');
const planing = require('./planing');

module.exports = function planning($p, log, route) {
  keys($p, log, route);
  needs($p, log, route);
  planing($p, log, route);
}
