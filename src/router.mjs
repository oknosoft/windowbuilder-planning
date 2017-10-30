'use strict';

const debug = require('debug')('wb:router');
debug('start');

const Router = require('koa-better-router');
const router = Router({prefix: '/plan'});

router.loadMethods()
  .get('/:where/:when', require('./get'));
//.post('/:class/:ref', require('./post'));

export default router;
