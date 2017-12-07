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
    const keys_delivery = [];
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
            const ref = param_key.ref;
            if (keys_delivery.indexOf(ref) == -1) {
              keys_delivery.push(ref);
            }
          })
      })
      }
    })

    let days_to_execution = 0;

    for (const ref in characteristics) {
      const characteristic = cat.characteristics.create(characteristics[ref], false, true);
      const {props_for_plan} = characteristic;

      days_to_execution = Math.max(days_to_execution, props_for_plan.days_to_execution);
    }

    const cur_day = moment().startOf('day');
    const start = (cur_day > moment(calc_order.date) ? cur_day : moment(calc_order.date)).add(days_to_execution, 'days');
    const stop = start.clone().add(20, 'days');

    // получим остатки регистра
    const rem = await reminder({params: {ref: `plan,${start.format('YYYYMMDD')},${stop.format('YYYYMMDD')},${keys_delivery.join(',')}`}});

    const res_plan = [];

    //Посчитаем общую требуемую мощность доставки,
    //чтобы сократить число циклов планирования, если по ключу доставки явно не хватает мощности
    //пока считаем по количеству
    const needed_performance = calc_order.production.aggregate('','quantity');

    let ready = false;

    rem.forEach((rem_str) => {
        if (rem_str.total >= needed_performance && !ready) {

          calc_order.production.forEach((row) => {
            res_plan.push({date:rem_str.date, key: rem_str.key.ref, elm:0, obj:row.characteristic.ref, performance:row.quantity, phase:'plan', specimen:0});
          })

          ready = true;
        }
      }
    )

    // освобождаем память
    calc_order && calc_order.unload();
    for (const ref in characteristics) {
      cat.characteristics.by_ref[ref] && cat.characteristics.by_ref[ref].unload();
    }

    // возвращаем результат
    ctx.body = {ok: true, rows: res_plan};


  }
  catch (err) {
    ctx.status = 500;
    ctx.body = err ? (err.stack || err.message) : `Ошибка при планировании заказа ${res.ref}`;
    debug(err);
  }

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
