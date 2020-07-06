

/**
 * Корневой обработчик get-запросов
 * @param $p
 * @param log
 * @return {function(...[*]=)}
 */
module.exports = function ($p, log) {

  const {utils: {end, moment}, adapters, cat} = $p;

  /**
   * Возвращает остаток и обороты регистра планирования
   * /plan/reminder/plan,20170801,20170802,305e3746-3aa9-11e6-bf30-82cf9717e145,cb5bc9bc-708a-11e7-ab3b-b09a52334246
   * @param prms
   * @param [allkey]
   * @return {Promise}
   */
  async function reminder(prms, allkey) {

    // параметры запроса получаем из контекста
    const [phase, date_from, date_till, ...keys] = (prms || '').split(',');

    // выполняем запрос к couchdb
    const res = await adapters.pouch.remote.doc.query('server/planning', {
      reduce: true,
      group: true,
      startkey: [phase, date_from],
      endkey: [phase, date_till, '\ufff0'],
      limit: 1000,
    });

    // guid-ы ключей заменим data-объектами, а строки дат объектами moment()
    const {parameters_keys, characteristics} = cat;

    return res.rows
      // фильтруем результат по положительному остатку и подходящему ключу
      .filter((v) => v.value.total > 0 && (!keys || !keys.length || keys.indexOf(v.key[2]) !== -1))
      // выпрямляем данные индекса в обычный объект
      .map(({key, value}) => ({
        date: moment(key[1]),
        key: parameters_keys.get(key[2]),
        allkey: (allkey) ? {obj: characteristics.get(key[3]), specimen: key[4], elm: key[5]} : undefined,
        ...value,
      }));
  }

  async function get(req, res) {
    const {path, paths} = req.parsed;

    try {
      switch (paths[3]) {
      case 'reminder':
        const rem = await reminder(paths[4]);
        rem.forEach((v) => v.key = {ref: v.key.ref, name: v.key.name});
        res.end(JSON.stringify(rem));
        return;

      default:
        end.end404(res, path);
      }
    } catch (err) {
      end.end500({res, err, log});
    }

  }

  return {get, reminder};
}

