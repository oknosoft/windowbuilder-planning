
// модификаторы data-объектов
import modifiers from './modifiers.mjs';

import logger from 'debug';
const debug = logger('wb:meta');

// конструктор MetaEngine
const MetaEngine = require('metadata-core')
  .plugin(require('metadata-pouchdb'));
debug('required');

// создаём контекст MetaEngine
const $p = new MetaEngine();
debug('created');


// инициализируем параметры сеанса и метаданные
(async () => {

  // функция установки параметров сеанса
  const config_init = require('../../config/app.settings');

  // функция инициализации структуры метаданных
  const meta_init = require('./init');

  // реквизиты подключения к couchdb
  const {user_node} = config_init();

  // инициализируем метаданные
  $p.wsql.init(config_init, meta_init);

  // подключим модификаторы
  modifiers($p);
  debug('inited & modified');

  // загружаем кешируемые справочники в ram и начинаем следить за изменениями ram
  const {pouch} = $p.adapters;
  pouch.log_in(user_node.username, user_node.password)
    .then(() => pouch.load_data())
    .catch((err) => debug(err));

  pouch.on({
    user_log_in(name) {
      debug(`logged in ${$p.job_prm.couch_local}, user:${name}, zone:${$p.job_prm.zone}`);
    },
    user_log_fault(err) {
      debug(`login error ${err}`);
    },
    pouch_load_start(page) {
      debug('loadind to ram: start');
    },
    pouch_data_page(page) {
      debug(`loadind to ram: page №${page.page} (${page.page * page.limit} from ${page.total_rows})`);
    },
    pouch_complete_loaded(page) {
      debug(`ready to receive queries, listen on port: ${process.env.PORT || 3021}`);
    },
    pouch_doc_ram_loaded() {
      pouch.local.ram.changes({
        since: 'now',
        live: true,
        include_docs: true,
      }).on('change', (change) => {
        // формируем новый
        pouch.load_changes({docs: [change.doc]});
      }).on('error', (err) => {
        // handle errors
      });
      debug(`loadind to ram: READY`);
    },
  });

})();

export default $p;




