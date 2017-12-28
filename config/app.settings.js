/**
 * ### При установке параметров сеанса
 * Процедура устанавливает параметры работы программы при старте веб-приложения
 *
 * @param prm {Object} - в свойствах этого объекта определяем параметры работы программы
 */
module.exports = function settings(prm) {

  return Object.assign(prm || {}, {

    // разделитель для localStorage
    local_storage_prefix: "wb_",

    // гостевые пользователи для демо-режима
    guests: [],

    // расположение couchdb
    couch_path: process.env.COUCHPATH || process.env.COUCHLOCAL || "http://localhost:5984/wb_",

    // расположение couchdb для nodejs
    couch_local: process.env.COUCHLOCAL || "http://localhost:5984/wb_",

    couch_direct: true,

    // авторизация couchdb
    user_node: {
      username: process.env.DBUSER || 'admin',
      password: process.env.DBPWD || 'admin',
    },

    pouch_filter: {
      meta: "auth/meta"
    },

    // по умолчанию, обращаемся к зоне 21
    zone: process.env.ZONE || 21,

    // объявляем номер демо-зоны
    zone_demo: 1,

    // если use_meta === false, не используем базу meta в рантайме
    // см.: https://github.com/oknosoft/metadata.js/issues/255
    use_meta: false,

    // размер вложений
    attachment_max_size: 10000000,


  });

}
