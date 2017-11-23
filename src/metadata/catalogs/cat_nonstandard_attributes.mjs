/**
 * ### Дополнительные методы справочника Признаки нестандартов
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2017
 *
 * @module cat_nonstandard_attributes
 */

export default function ($p) {
  $p.cat.nonstandard_attributes.metadata().cachable = "doc_ram";

  //Фукнция определения признака нестандарта по параметрам
  $p.cat.nonstandard_attributes.__define({
    key_by_params: {
      value: function (params) {
        const res = $p.wsql.alasql("select ref from cat_nonstandard_attributes where (crooked=? and colored=? and lay=? and made_to_order=? and packing=?)"
          , [params.crooked||false, params.colored||false, params.lay||false, params.made_to_order||false, params.packing||false]);

        return (res.length == 0 ? undefined : res[0].ref);
      }
      }
  })
}
