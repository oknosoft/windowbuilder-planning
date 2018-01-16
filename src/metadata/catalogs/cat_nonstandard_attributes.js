/**
 * ### Дополнительные методы справочника Признаки нестандартов
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2018
 *
 * @module cat_nonstandard_attributes
 */

export default function ($p) {
  $p.cat.nonstandard_attributes.metadata().cachable = 'doc_ram';

  //Фукнция определения признака нестандарта по параметрам
  $p.cat.nonstandard_attributes.__define({
    key_by_params: {
      value: function (params) {
        const res = $p.cat.nonstandard_attributes.find_rows({
          crooked: params.crooked || false,
          colored: params.colored || false,
          lay: params.lay || false,
          made_to_order: params.made_to_order || false,
          packing: params.packing || false
        });

        return (res.length == 0 ? undefined : res[0]);
      }
    }
  });
}
