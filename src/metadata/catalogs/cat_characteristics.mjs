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
    prop_for_plan: {
      get: function () {
        //Фурнитура
        const furns = $p.wsql.alasql("select first(furn) from ? where furn <> ?", [this.constructions._obj, $p.utils.blank.guid]);

        return {
          sys: this.sys,
          furn: (furns.length == 0 ? $p.utils.blank : $p.cat.furns.get(furns[0]["FIRST(furn)"]))
        }
      }
    }
    }
  )
}
