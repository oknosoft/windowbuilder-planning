'use strict';

import logger from 'debug';
const debug = logger('wb:router');
debug('start');

import Router from 'koa-better-router';
import get from './get';
//import post from './post';
const router = Router({prefix: '/plan'});

router.loadMethods()
  .get('/:class/:ref', get);
//.post('/:class/:ref', post);

debugger;

export default router;
