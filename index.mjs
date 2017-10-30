#!/usr/bin/env node

'use strict';

const Koa = require('koa');
const app = new Koa();

// Register the logger as Koa middleware
import log from './src/log';
app.use(log);

// Register the router as Koa middleware
import router from './src/router';
app.use(router.middleware());

app.listen(process.env.PORT || 3021);

module.exports = app;
