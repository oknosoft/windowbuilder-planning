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
    if(!utils.is_guid(res.ref)) {
      ctx.status = 404;
      ctx.body = `Параметр запроса ref=${res.ref} не соответствует маске уникального идентификатора`;
      return;
    }

    // разворачиваем в озу объект заказа и характеристики
    const {characteristics} = _query;
    delete _query.characteristics;
    const calc_order = doc.calc_order.create(_query, false, true);
    for (const ref in characteristics) {
      cat.characteristics.create(characteristics[ref], false, true);
    }

    // получим остатки регистра
    const start = moment(calc_order.date);
    const stop = start.clone().add(10, 'days');
    const rem = await reminder({params: {ref: `plan,${start.format('YYYYMMDD')},${stop.format('YYYYMMDD')}`}});

    // освобождаем память
    calc_order && calc_order.unload();
    for (const ref in characteristics) {
      cat.characteristics.by_ref[ref] && cat.characteristics.by_ref[ref].unload();
    }

    // возвращаем результат
    ctx.body = {ok: true};


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
