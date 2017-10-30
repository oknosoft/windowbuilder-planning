'use strict';

import logger from 'debug';
const debug = logger('wb:get');

import $p from './metadata';

debug('required');

async function log(ctx, next) {
  // данные авторизации получаем из контекста
  const {_auth, params} = ctx;
  const _id = `_local/log.${_auth.suffix}.${params.ref}`;
  ctx.body = await $p.adapters.pouch.remote.doc.get(_id)
    .catch((err) => ({error: true, message: `Объект ${_id} не найден\n${err.message}`}));
}

async function reminder(ctx, next) {

  // данные авторизации получаем из контекста
  const {_auth} = ctx;


  ctx.body = {reminder: 0};
}


export default async (ctx, next) => {

  try{
    switch (ctx.params.class){
    case 'log':
      return await log(ctx, next);
    case 'reminder':
      return await reminder(ctx, next);
    default:
      ctx.status = 404;
      ctx.body = {
        error: true,
        message: `Неизвестный класс ${ctx.params.class}`,
      };
    }
  }
  catch(err){
    ctx.status = 500;
    ctx.body = {
      error: true,
      message: err.stack || err.message,
    };
    debug(err);
  }

};
