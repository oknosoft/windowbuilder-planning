
module.exports = function planningModifiers($p) {

  $p.cat.work_centers.constructor.RowsFragment = require('./graph/RowsFragment')($p);
  $p.CatProduction_kinds.StagesSequence = require('./graph/Sequence');
}
