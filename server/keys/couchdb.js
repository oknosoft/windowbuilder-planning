
const { Readable } = require('node:stream');
const sleepTimeout = 6;

/**
 * @summary Аналог PouchDB.Changes в live-режиме
 * @desc Слушает базу Couchdb, перезапускает при ошибке.
 * Отличается от оригинала, асинхронным обработчиком событий
 */
class Subscriber {

  constructor(owner, opts) {
    this.owner = owner;
    this.since = opts.since;
    this.handlers = {};
    this.fetch = this.fetch.bind(this);
    Promise.resolve().then(this.fetch);
  }

  /**
   * @summary Подключает обработчик события
   * @param {String} event
   * @param {Function} handler
   * @return {Subscriber}
   */
  on(event, handler) {
    this.handlers[event] = handler;
    return this;
  }

  /**
   * @summary Запрос к фиду Couchdb
   * @desc Перезапускается на вершине и ошибках
   * @return {Promise<void>}
   */
  async fetch() {
    if(this.isCancelled) {
      return;
    }
    const {since, owner: {name, headers, allReaded}, handlers} = this;
    let url = `${name}/_changes?heartbeat=40000&style=all_docs&include_docs=true&limit=40`;
    if(allReaded) {
      url += `&feed=longpoll`;
    }
    if(since) {
      url += `&since=${since}`;
    }
    if(!headers.has('Connection')) {
      headers.set('Connection', 'keep-alive');
    }

    try {
      this.controller = new AbortController();
      const { signal } = this.controller;
      const res = await fetch(url, {headers, signal}).then(res => res.json());
      const {last_seq, results, pending} = res;
      const {change} = handlers;
      if(Array.isArray(results)) {
        for(const item of results) {
          await change(item);
          this.since = item.seq;
        }
        if(!pending) {
          if(!allReaded) {
            this.owner.allReaded = true;
          }
          if(!handlers.allReaded.wasCalled) {
            await handlers.allReaded?.();
          }
        }
        if(!this.isCancelled) {
          setTimeout(this.fetch, sleepTimeout);
        }
      }
      else if(!this.isCancelled) {
        this.handlers.error?.(res);
      }
    }
    catch (e) {
      if (e.name !== 'AbortError') {
        this.handlers.error(e);
      }
    }
  }

  /**
   * @summary Останавливает слушателя
   */
  cancel() {
    this.controller?.abort();
    this.isCancelled = true;
  }
}

/**
 * @summary Аналог базы PouchDB
 * @desc Предоставляет ограниченный и упрощенный интерфейс с нативным fetch()
 */
class Couchdb {

  constructor(name, {auth}) {
    this.name = name;
    this.headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(auth.username + ':' + auth.password, 'utf8').toString('base64')}`,
    });
    this.multiplier = 1;
    this.allReaded = false;
  }

  /**
   * @summary Запрос к Couchdb
   * @param {String} path
   * @param {Object} [opts]
   * @return {Promise<any>}
   */
  fetch(path = '', opts) {
    const {name, headers} = this;
    return fetch(name + path, {headers, ...opts})
      .then(res => res.json());
  }

  /**
   * @summary Аналог info() PouchDB
   * @return {Promise<*>}
   */
  info() {
    return this.fetch();
  }

  /**
   * @summary Создаёт слушателя изменений текущей базы
   * @param opts
   * @return {Subscriber}
   */
  changes(opts) {
    return new Subscriber(this, opts);
  }

  /**
   * @summary Аналог get() PouchDB
   * @return {Promise<*>}
   */
  get(id, rev, attachments) {
    const {name, headers} = this;
    let path = `${name}/${id}`;
    if(rev) {
      path += `?rev=${rev}`;
    }
    if(attachments) {
      path += `${rev ? '&' : '?'}attachments=true`;
    }
    return fetch(path, {headers})
      .then(res => res.json());
  }

  attachment(id, rev, res) {
    const {name, headers} = this;
    let path = `${name}/${id}`;
    if(rev) {
      path += `?rev=${rev}`;
    }
    return fetch(path, {headers})
      .then(fetchRes => {
        return new Promise((resolve, reject) => {
          if(fetchRes.ok) {
            for(const [name, value] of fetchRes.headers) {
              res.setHeader(name, value);
            }
            res.setHeader('X-Duration', res.took());
            Readable.fromWeb(fetchRes.body)
              .pipe(res)
              .on('error', reject)
              .on('close', resolve);
          }
          else {
            const err = new Error(`HTTP network error`);
            err.status = fetchRes.status;
            reject(err);
          }
        });
      });
  }

  /**
   * @summary Аналог bulk_get() PouchDB
   * @return {Promise<*>}
   */
  bulk_get(docs) {
    const {name, headers} = this;
    return fetch(`${name}/_bulk_get`, {method: 'POST', headers, body: JSON.stringify({docs})})
      .then(res => res.json());
  }
}

module.exports = Couchdb;
