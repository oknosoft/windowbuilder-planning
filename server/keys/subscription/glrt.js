
const glrt = [];
module.exports = function ($p) {
  if(!glrt.length) {
    const {inserts_glass_types} = $p.enm;
    glrt.push(inserts_glass_types.Заполнение,
      inserts_glass_types.СтеклоСПодогревом,
      inserts_glass_types.СтеклоЗакаленное,
      inserts_glass_types.СтеклоЭнергоСб,
      inserts_glass_types.СтеклоЦветное,
      inserts_glass_types.Триплекс);
  }
  return glrt;
}
