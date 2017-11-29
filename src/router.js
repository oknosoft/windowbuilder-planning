'use strict';

const debug = require('debug')('wb:router');
debug('start');

import Router from 'koa-better-router';
import get from './get';
import post from './post';
const router = Router({prefix: '/plan'});

router.loadMethods()
  .get('/:class/:ref', get)
  .post('/:class/:ref', post);


export default router;
