'use strict';

import $p from './metadata';

import {reminder} from './get';

const debug = require('debug')('wb:post');
debug('required');


/**
 * Рассчитывает даты планирования для продукций заказа
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
async function calc_order(ctx, next) {

  const {_query, params} = ctx;
  const res = {ref: params.ref, production: []};
  const {cat, doc, utils, job_prm} = $p;
  const {contracts, nom, inserts, clrs} = cat;

  try {
    if (!utils.is_guid(res.ref)) {
      ctx.status = 404;
      ctx.body = `Параметр запроса ref=${res.ref} не соответствует маске уникального идентификатора`;
      return;
    }

    // разворачиваем в озу объект заказа и характеристики
    const {characteristics} = _query;
    delete _query.characteristics;
    const calc_order = doc.calc_order.create(_query, false, true);

    //Ключи доставки
    const all_keys = new Set();
    const {cache_by_elements} = cat.delivery_directions;

    //Ключи доставки нужны по подразделению и району доставки
    [calc_order.delivery_area, calc_order.department].forEach((elm) => {
      const keys = cache_by_elements[elm];
      if (keys) {
        keys.forEach((key_delivery) => {
          const parameters_keys = cat.parameters_keys.keys_by_params({
            applying: 'НаправлениеДоставки',
            delivery_direction: key_delivery
          });

          parameters_keys.forEach((param_key) => {
            all_keys.add(param_key.ref);
          })
      })
      }
    })

    let days_to_execution = 0;

    for (const ref in characteristics) {
      const characteristic = cat.characteristics.create(characteristics[ref], false, true);
      const {props_for_plan} = characteristic;

      const parameters_keys = cat.parameters_keys.keys_by_params(
        Object.assign({applying: 'РабочийЦентр'}, props_for_plan));

      const need_numbers = new Set();

      parameters_keys.forEach((param_key)=>{
        all_keys.add(param_key.ref);
        need_numbers.add(param_key.sorting_field);
      });

      //Прицепляем к характеристике ключи, которые подходят/нужны для ее производства
      Object.assign(characteristic, {parameters_keys : parameters_keys.slice(), need_numbers:need_numbers});

      days_to_execution = (days_to_execution > props_for_plan.days_to_execution ? days_to_execution : props_for_plan.days_to_execution);
    }

    const cur_day = moment().startOf('day').add(1, 'days');
    const start = (cur_day > moment(calc_order.date) ? cur_day : moment(calc_order.date)).add(days_to_execution, 'days');
    const stop = start.clone().add(20, 'days');

    // получим остатки регистра по всем ключам сразу, чтобы два раза не бегать на сервер
    const rem = await reminder({params: {ref: `plan,${start.format('YYYYMMDD')},${stop.format('YYYYMMDD')},${Array.from(all_keys).join(',')}`}});

    //Посчитаем общую требуемую мощность доставки,
    //чтобы сразу отобрать те ключи доставки, которые могут обеспечить нужное количество
    //пока считаем по количеству
    const needed_performance = calc_order.production.aggregate('','quantity');

    //Остатки неплохо бы отсортировать и разделить на две части - доставку и производство
    const rem_delivery = $p.wsql.alasql('select * FROM ? WHERE key->applying = ? AND total >= ? ORDER BY date, key->priority DESC, total DESC', [rem, $p.enm.parameters_keys_applying['НаправлениеДоставки'], needed_performance]);
    const rem_main = $p.wsql.alasql('select *, key->sorting_field AS number FROM ? WHERE key->applying = ? ORDER BY key->sorting_field DESC, date DESC, key->priority DESC', [rem, $p.enm.parameters_keys_applying['РабочийЦентр']]);

    const res_plan = [];

    let ok = (rem_delivery.length > 0);
    let i = 0;
    const length_delivery = rem_delivery.length;

    if (ok) {
      do {
        const row_delivery = rem_delivery[i];
        i++;

        //колонку остатков будем хранить отдельно
        const totals = new Map();

        //Обрежем массив мощностей ключей по дате, чтобы не бегать по всей таблице
        const rem_main_cur = rem_main.filter(row => {
          return row.date <= row_delivery.date;
        });

        rem_main_cur.forEach((row)=>{
          totals.set(row, row.total);
        })

        res_plan.length = 0;
        ok = true;

        calc_order.production.forEach((row_order) => {
          let date = row_delivery.date;
          //В этом set будем хранить запланированные номера операций
          const planned_numbers = new Set();

          const {characteristic} = row_order;

          rem_main_cur.forEach((row_main) => {
            if (totals.get(row_main) >= row_order.quantity && !planned_numbers.has(row_main.number) && row_main.date <= date && characteristic.parameters_keys.indexOf(row_main.key) > -1) {
              res_plan.push({
                date: row_main.date,
                key: row_main.key.ref,
                elm: 0,
                obj: characteristic.ref,
                performance: row_order.quantity,
                phase: 'plan',
                specimen: 0
              })

              planned_numbers.add(row_main.number);
              totals.set(row_main, totals.get(row_main) - row_order.quantity);
              date = row_main.date;
            }
          })

          //результат считаем успешным, если удалось запланировать все номера операций, требуемые данной характеристике
          if (planned_numbers.size != characteristic.need_numbers.size) {
            ok = false;
          }
        })
        //Если все получилось, то добавляем строку с ключом доставки
        if (ok) {
          res_plan.push({
            date: row_delivery.date,
            key: row_delivery.key.ref,
            elm: 0,
            performance: needed_performance,
            phase: 'plan',
            specimen: 0
          });
        }
        else {
          res_plan.length = 0;
        }
      } while (ok == false && i < length_delivery)
    }

    //Если ничего не удалось запланировать по производству, добавим доставку - первую строку, самую близкую по дате
    if (!res_plan.length && rem_delivery.length){
      const row_delivery = rem_delivery[0];

      res_plan.push({
        date: row_delivery.date,
        key: row_delivery.key.ref,
        elm: 0,
        performance: needed_performance,
        phase: 'plan',
        specimen: 0
      });
    }

    // освобождаем память
    calc_order && calc_order.unload();
    for (const ref in characteristics) {
      cat.characteristics.by_ref[ref] && cat.characteristics.by_ref[ref].unload();
    }

    // возвращаем результат
    ctx.body = {ok: ok, rows: res_plan};


  }
  catch (err) {
    ctx.status = 500;
    ctx.body = err ? (err.stack || err.message) : `Ошибка при планировании заказа ${res.ref}`;
    debug(err);
  }

}

//Запускает загрузку данных из doc
async function load_doc_ram(ctx, next) {
  $p.adapters.pouch.load_doc_ram();
  ctx.body = {'doc_ram_loading_started': true};
}

/**
 * Корневой обработчик post-запросов
 * @param ctx
 * @param next
 * @return {Promise.<*>}
 */
export default async (ctx, next) => {

  try {
    switch (ctx.params.class) {
      case 'doc.calc_order':
        return await calc_order(ctx, next);
      case 'load_doc_ram':
        return load_doc_ram(ctx, next);
      default:
        ctx.status = 404;
        ctx.body = {
          error: true,
          message: `Неизвестный класс ${ctx.params.class}`,
        };
    }
  }
  catch (err) {
    ctx.status = 500;
    ctx.body = {
      error: true,
      message: err.stack || err.message,
    };
    debug(err);
  }

};
