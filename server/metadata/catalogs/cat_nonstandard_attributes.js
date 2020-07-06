/**
 * ### Дополнительные методы справочника Признаки нестандартов
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2018
 *
 * @module cat_nonstandard_attributes
 */

module.exports = function ({cat}) {
  cat.nonstandard_attributes.metadata().cachable = 'doc_ram';

  //Фукнция определения признака нестандарта по параметрам
  cat.nonstandard_attributes.key_by_params = function(params) {
    const res = cat.nonstandard_attributes.find_rows({
      crooked: params.crooked || false,
      colored: params.colored || false,
      lay: params.lay || false,
      made_to_order: params.made_to_order || false,
      packing: params.packing || false
    });

    return (res.length == 0 ? undefined : res[0]);
  };
}
