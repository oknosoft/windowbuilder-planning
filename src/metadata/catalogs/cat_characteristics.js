/**
 * ### Дополнительные методы справочника Характеристики
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2017
 *
 * @module cat_characteristics
 */

export default function ($p) {

  //Добавляем свойства характеристике
  $p.CatCharacteristics.prototype.__define({
    //содержит свойства, необходимые для работы микросервиса планирования
    //перечень свойств можно расширить, добавив недостающие в возвращаемый объект
    props_for_plan: {
      get: function () {
        //Фурнитура
        const furns = $p.wsql.alasql("select first(furn) as furn from ? where furn <> ?", [this.constructions._obj, $p.utils.blank.guid]);

        const res = {
          sys: this.sys,
          furn: (furns.length == 0 ? $p.utils.blank : $p.cat.furns.get(furns[0].furn)),
          crooked: false,
          colored: false,
          lay: false,
          made_to_order: false,
          packing: false,
          days_to_execution: 0
        };

        const specification = this.specification._obj;

        specification.reduce((res, row)=>{
          const nom = $p.cat.nom.get(row.nom);

          res.crooked = res.crooked || !!nom.crooked;
          res.colored = res.colored || !!nom.colored;
          res.lay = res.lay || !!nom.lay;
          res.made_to_order = res.made_to_order || !!nom.made_to_order;
          res.packing = res.packing || !!nom.packing;

          res.days_to_execution = Math.max(res.days_to_execution, nom.days_to_execution);

          return res;
        }, res)

        return res;
      }
    }
    }
  )
}
