#!/usr/bin/env node

'use strict';

import Koa from 'koa';
const app = new Koa();

// Register the logger as Koa middleware
import log from './src/log';
app.use(log);

// Register the router as Koa middleware
import router from './src/router';
app.use(router.middleware());

app.listen(process.env.PORT || 3021);
app.restrict_ips = process.env.IPS ? process.env.IPS.split(',') : [];

export default app;
