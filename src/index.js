'use strict';

process.env.DEBUG = 'wb:,-not_this';

const Koa = require('koa');
const app = new Koa();

// Register the cors as Koa middleware
const cors = require('@koa/cors');
app.use(cors({credentials: true, maxAge: 600}));

// Register the logger as Koa middleware
import log from './log';
app.use(log);

// Register the router as Koa middleware
import router from './router';
app.use(router.middleware());

app.listen(process.env.PORT || 3021);
app.restrict_ips = process.env.IPS ? process.env.IPS.split(',') : [];

export default app;
