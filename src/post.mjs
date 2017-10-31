'use strict';

import $p from './metadata';

import {reminder} from './get'

import logger from 'debug';
const debug = logger('wb:post');
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
    if(!utils.is_guid(res.ref)){
      ctx.status = 404;
      ctx.body = `Параметр запроса ref=${res.ref} не соответствует маске уникального идентификатора`;
      return;
    }


  }
  catch (err) {
    ctx.status = 500;
    ctx.body = err ? (err.stack || err.message) : `Ошибка при планировании заказа ${res.ref}`;
    debug(err);
  }

}

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
