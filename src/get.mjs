'use strict';

import $p from './metadata';

import logger from 'debug';
const debug = logger('wb:get');
debug('required');

async function log(ctx, next) {
  // данные авторизации получаем из контекста
  const {_auth, params} = ctx;
  const _id = `_local/log.${_auth.suffix}.${params.ref}`;
  ctx.body = await $p.adapters.pouch.remote.doc.get(_id)
    .catch((err) => ({error: true, message: `Объект ${_id} не найден\n${err.message}`}));
}

/**
 * Возвращает остаток и обороты регистра планирования
 * /plan/reminder/План,20170801,20170802,305e3746-3aa9-11e6-bf30-82cf9717e145,cb5bc9bc-708a-11e7-ab3b-b09a52334246
 * @param ctx
 * @param next
 * @return {Promise.<Array>}
 */
export async function reminder(ctx, next) {

  // данные авторизации получаем из контекста
  const [phase, date_from, date_till, ...keys] = ctx.params.ref.split(',');
  const res = await $p.adapters.pouch.remote.doc.query('server/planning', {
    reduce: true,
    group: true,
    startkey: [phase, date_from],
    endkey: [phase, date_till, '\ufff0'],
    limit: 1000,
  });

  const {parameters_keys} = $p.cat;
  return res.rows
    .filter((v) => !keys || !keys.length || keys.indexOf(v.key[2]) !== -1)
    .map(({key, value}) => ({
      date: moment(key[1]),
      key: parameters_keys.get(key[2]),
      ...value,
    }));
}


export default async (ctx, next) => {

  try {
    switch (ctx.params.class) {
    case 'log':
      return await log(ctx, next);
    case 'reminder':
      const rem = await reminder(ctx, next);
      rem.forEach((v) => v.key = {ref: v.key.ref, name: v.key.name});
      ctx.body = rem;
      return;
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
