const {classes} = require('metadata-core');

class Accumulation extends classes.MetaEventEmitter {

  constructor($p) {
    super();
    this.$p = $p;
    // интервал опроса и пересчета
    this.interval = 60000;
    // указатель на текущий таймер
    this.timer = 0;

  }

  /**
   * создаёт базу и подключается
   */
  init() {
    const {Client} = require('pg');
    const conf = {
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      password: process.env.PGPASSWORD,
      database: 'postgres',
    };
    const client = new Client(conf);
    return client.connect()
      .then(() => {
        const {job_prm} = $p;
        conf.database = 'planning-keys';
        return client.query(`SELECT 1 FROM pg_database WHERE datname = '${conf.database}'`)
      })
      .then(({rows}) => !rows.length && client.query(`CREATE DATABASE 'planning-keys'
    WITH OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'ru_RU.UTF-8@icu'
    LC_CTYPE = 'ru_RU.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    IS_TEMPLATE = False;`)
      )
      .then(() => client.query(`CREATE EXTENSION IF NOT EXISTS 'uuid-ossp';`))
      .then((create_metadata) => {
        const reconnect = (client) => {
          return client.end()
            .then(() => {
              this.client = new Client(conf);
              return this.client.connect();
            })
        };
        return reconnect(client)
          .then(() => {
            if(create_metadata) {
              return db_metadata()
                .then(() => reconnect(this.client));
            }
          });
      })
      .then(() => this.set_param('date', Date.now()))
      .then(() => {
        this.emit('init');
        this.execute();
      })
      .catch((err) => this.emit('err', err));
  }

  /**
   * Создаёт таблицы, индексы и триггеры
   * @return {Promise<void>}
   */
  db_metadata() {
    const {client} = this;
    const raw = require('fs').readFileSync(require.resolve('./pg.sql'), 'utf8').split('\n');
    let sql = '';
    for(const row of raw) {
      sql += '\n';
      if(!row.startsWith('--')){
        sql += row;
      }
    }
    for(let i = 0; i < 5; i++) {
      sql = sql.replace(/\n\n\n/g, '\n\n');
    }
    let res = Promise.resolve();
    for(const row of sql.split('\n\n')) {
      if(!row) {
        continue;
      }
      res = res.then(() => client.query(row));
    }
    return res;
  }

  /**
   * Фильтр для changes по class_name активных listeners
   */
  changes_selector() {
    const names = new Set();
    for(const {class_name} of this.listeners) {
      names.add(class_name);
    }
    return {class_name: {$in: Array.from(names)}};
  }

  /**
   * Читает и обрабатывает изменения конкретной базы
   * @param db
   */
  changes(db) {
    const limit = 200;
    const conf = {
      include_docs: true,
      selector: this.changes_selector(),
      limit,
      batch_size: limit,
    };
    return this.get_param(`changes:${db.name}`)
      .then((since) => {
        if(since) {
          conf.since = since;
        }
        return db.changes(conf);
      })
      .then((res) => {
        let queue = Promise.resolve();
        for(const {doc} of res.results) {
          for(const {class_name, listener} of this.listeners) {
            if(doc._id.startsWith(class_name + '|')) {
              queue = queue
                .then(() => listener(db, this, doc).catch((err) => {
                  console.log(doc._id);
                  this.emit('err', [err, doc]);
                }));
            }
          }
        }
        return queue
          .then(() => res.last_seq && conf.since !== res.last_seq && this.set_param(`changes:${db.name}`, res.last_seq))
          .then(() => res.results.length === limit && this.changes(db));
      });
  }

  /**
   * Бежит по всем датабазам, читает изменения и перестраивает индексы
   */
  execute() {
    clearTimeout(this.timer);
    const {changes, execute, dbs, interval} = this;
    return Promise.all(dbs.map(changes))
      .catch((err) => this.emit('err', err))
      .then(() => {
        this.timer = setTimeout(execute, interval);
      });
  }

  /**
   * создаёт таблицы регистров
   * @param def
   */
  create_tables(def = []) {

  }

  set_param(name, value) {
    return this.client.query(`INSERT INTO settings (param, value) VALUES ('${name}', '${value}')
      ON CONFLICT (param) DO UPDATE SET value = EXCLUDED.value;`);
  }

  get_param(name) {
    return this.client.query(`select value from settings where param = '${name}';`)
      .then(({rows}) => rows.length ? rows[0].value : '');
  }
}
