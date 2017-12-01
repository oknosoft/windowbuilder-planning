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

        const nom = this.specification.unload_column("nom");
        //признаки нестандартов
        const non_standard = $p.wsql.alasql("select sum(crooked) as crooked, sum(colored) as colored, sum(lay) as lay, sum(made_to_order) as made_to_order, sum(packing) as packing from ?", [nom]);
        const days_to_execution = $p.wsql.alasql("select min(days_to_execution) as days_to_execution from ?", [nom]);

        return {
          sys: this.sys,
          furn: (furns.length == 0 ? $p.utils.blank : $p.cat.furns.get(furns[0].furn)),
          crooked: non_standard[0].crooked > 0,
          colored: non_standard[0].colored > 0,
          lay: non_standard[0].lay > 0,
          made_to_order: non_standard[0].made_to_order > 0,
          packing: non_standard[0].packing > 0,
          days_to_execution: days_to_execution[0].days_to_execution
        }
      }
    }
    }
  )
}
