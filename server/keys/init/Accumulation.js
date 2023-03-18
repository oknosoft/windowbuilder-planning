const {classes} = require('metadata-core');

class Accumulation extends classes.MetaEventEmitter {

  constructor($p) {
    super();
    this.$p = $p;
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
      .then(() => this.set_param('start', {date: new Date()}))
      .then(() => {
        this.emit('init');
        return this;
      });
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

  set_param(name, value) {
    return this.client.query(`INSERT INTO settings (param, value) VALUES ('${name}', '${JSON.stringify(value)}')
      ON CONFLICT (param) DO UPDATE SET value = EXCLUDED.value;`);
  }

  get_param(name) {
    return this.client.query(`select value from settings where param = '${name}';`)
      .then(({rows}) => rows.length ? rows[0].value : '');
  }
}

module.exports = Accumulation;
