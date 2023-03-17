
const Accumulation = require('./Accumulation');

// создаёт при необходимости базу данных и таблицы ключей планирования
module.exports = function keys_init($p, log) {
  const accumulation = new Accumulation($p);
}
