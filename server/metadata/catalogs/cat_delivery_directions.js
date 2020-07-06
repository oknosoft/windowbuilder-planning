/**
 * ### Дополнительные методы справочника Направления доставки
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2018
 *
 * @module cat_delivery_directions
 */

function cache(cat) {
  const res = {};

  cat.delivery_directions.forEach((elm_direction) => {
    elm_direction.composition.forEach((row) => {
      if (res[row.elm]) {
        res[row.elm].push(elm_direction);
      }
      else {
        res[row.elm] = [elm_direction];
      }
    })
  })

  return res;
}

module.exports = function ({cat, adapters}) {

  cat.delivery_directions.metadata().cachable = 'doc_ram';

  //Создаем свойство для хранения кеша направлений доставки по элементам (подразделения, районы доставки)
  cat.delivery_directions.__define({
    cache_by_elements: {
      value: {}
    }
  });

  //Подписываемся на событие окончания загрузки данных в ram
  adapters.pouch.once('pouch_doc_ram_loaded', () => {
    //После загрузки данных в ram заполняем кеш
    Object.assign(cat.delivery_directions.cache_by_elements, cache(cat));
  });
}

