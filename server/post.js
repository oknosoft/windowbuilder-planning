

/**
 * Корневой обработчик post-запросов
 * @param $p
 * @param log
 * @param reminder
 * @return {function(...[*]=)}
 */
module.exports = function ($p, log, reminder) {

  const {cat, doc, utils: {getBody, end, is_guid, moment}, wsql} = $p;

  /**
   * Рассчитывает даты планирования для продукций заказа
   * @param req
   * @param res
   * @return {Promise<void>}
   */
  async function calc_order(req, res) {

    const {paths} = req.parsed;
    const body = await getBody(req);
    const query = JSON.parse(body);

    const result = {ref: paths[4], production: []};

    const {contracts, nom, inserts, clrs} = cat;

    if(!is_guid(result.ref)) {
      return end.end404(res, `Параметр ref='${result.ref}' не соответствует маске уникального идентификатора`);
    }

    // разворачиваем в озу объект заказа и характеристики
    const {characteristics} = query;
    delete query.characteristics;
    const calc_order = doc.calc_order.create(query, false, true);

    //Ключи доставки
    const all_keys = new Set();
    const {cache_by_elements} = cat.delivery_directions;

    //Ключи доставки нужны по подразделению и району доставки
    [calc_order.delivery_area, calc_order.department].forEach((elm) => {
      const keys = cache_by_elements[elm];
      if(keys) {
        keys.forEach((key_delivery) => {
          const parameters_keys = cat.parameters_keys.keys_by_params({
            applying: 'НаправлениеДоставки',
            delivery_direction: key_delivery
          });

          parameters_keys.forEach((param_key) => {
            all_keys.add(param_key.ref);
          });
        });
      }
    });

    let days_to_execution = 0;

    for (const ref in characteristics) {
      const characteristic = cat.characteristics.create(characteristics[ref], false, true);
      const {props_for_plan} = characteristic;

      const parameters_keys = cat.parameters_keys.keys_by_params(
        Object.assign({applying: 'РабочийЦентр'}, props_for_plan));

      const need_numbers = new Set();

      parameters_keys.forEach((param_key) => {
        all_keys.add(param_key.ref);
        need_numbers.add(param_key.sorting_field);
      });

      //Прицепляем к характеристике ключи, которые подходят/нужны для ее производства
      Object.assign(characteristic, {parameters_keys: parameters_keys.slice(), need_numbers: need_numbers});

      days_to_execution = (days_to_execution > props_for_plan.days_to_execution ? days_to_execution : props_for_plan.days_to_execution);
    }

    const cur_day = moment().startOf('day').add(1, 'days');
    const start = (cur_day > moment(calc_order.date) ? cur_day : moment(calc_order.date)).add(days_to_execution, 'days');
    const stop = start.clone().add(20, 'days');

    // получим остатки регистра по всем ключам сразу, чтобы два раза не бегать на сервер
    const rem = await reminder({params: {ref: `plan,${start.format('YYYYMMDD')},${stop.format('YYYYMMDD')},${Array.from(all_keys).join(',')}`}});

    //Посчитаем общую требуемую мощность доставки,
    //чтобы сразу отобрать те ключи доставки, которые могут обеспечить нужное количество
    //пока считаем по количеству
    const needed_performance = calc_order.production.aggregate('', 'quantity');

    //Остатки неплохо бы отсортировать и разделить на две части - доставку и производство
    const rem_delivery = wsql.alasql('select * FROM ? WHERE key->applying = ? AND total >= ? ORDER BY date, key->priority DESC, total DESC', [rem, $p.enm.parameters_keys_applying['НаправлениеДоставки'], needed_performance]);
    const rem_main = wsql.alasql('select *, key->sorting_field AS number FROM ? WHERE key->applying = ? ORDER BY key->sorting_field DESC, date DESC, key->priority DESC', [rem, $p.enm.parameters_keys_applying['РабочийЦентр']]);

    const res_plan = [];

    let ok = (rem_delivery.length > 0);
    let i = 0;
    const length_delivery = rem_delivery.length;

    if(ok) {
      do {
        const row_delivery = rem_delivery[i];
        i++;

        //колонку остатков будем хранить отдельно
        const totals = new Map();

        //Обрежем массив мощностей ключей по дате, чтобы не бегать по всей таблице
        const rem_main_cur = rem_main.filter(row => {
          return row.date <= row_delivery.date;
        });

        rem_main_cur.forEach((row) => {
          totals.set(row, row.total);
        });

        res_plan.length = 0;
        ok = true;

        calc_order.production.forEach((row_order) => {
          let date = row_delivery.date;
          //В этом set будем хранить запланированные номера операций
          const planned_numbers = new Set();

          const {characteristic} = row_order;

          rem_main_cur.forEach((row_main) => {
            if(totals.get(row_main) >= row_order.quantity && !planned_numbers.has(row_main.number) && row_main.date <= date && characteristic.parameters_keys.indexOf(row_main.key) > -1) {
              //Строка-приход
              res_plan.push({
                date: row_main.date,
                key: row_main.key.ref,
                elm: 0,
                obj: characteristic.ref,
                performance: row_order.quantity,
                phase: 'run',
                specimen: 0
              });
              //Строка-расход
              res_plan.push({
                date: row_main.date,
                key: row_main.key.ref,
                elm: 0,
                performance: row_order.quantity,
                phase: 'plan',
                specimen: 0
              });

              planned_numbers.add(row_main.number);
              totals.set(row_main, totals.get(row_main) - row_order.quantity);
              date = row_main.date;
            }
          });

          //результат считаем успешным, если удалось запланировать все номера операций, требуемые данной характеристике
          if(planned_numbers.size != characteristic.need_numbers.size) {
            ok = false;
          }
        });
        //Если все получилось, то добавляем строку с ключом доставки
        if(ok) {
          res_plan.push({
            date: row_delivery.date,
            key: row_delivery.key.ref,
            elm: 0,
            performance: needed_performance,
            phase: 'plan',
            specimen: 0
          });
        }
        else {
          res_plan.length = 0;
        }
      } while (ok == false && i < length_delivery);
    }

    //Если ничего не удалось запланировать по производству, добавим доставку - первую строку, самую близкую по дате
    if(!res_plan.length && rem_delivery.length) {
      const row_delivery = rem_delivery[0];

      res_plan.push({
        date: row_delivery.date,
        key: row_delivery.key.ref,
        elm: 0,
        performance: needed_performance,
        phase: 'plan',
        specimen: 0
      });
    }

    // освобождаем память
    calc_order && calc_order.unload();
    for (const ref in characteristics) {
      cat.characteristics.by_ref[ref] && cat.characteristics.by_ref[ref].unload();
    }

    // возвращаем результат
    res.end({ok: ok, rows: res_plan});

  }


  //Создает/обновляет задания на производство (наряды на РЦ)
  async function create_work_centers_tasks(req, res){
    const {_query, route} = ctx;

    if(!_query.date_from || !_query.date_till){
      ctx.status = 403;
      ctx.error = true;
      ctx.body = `Не указаны даты начала и/или окончания`;
      return;
    }

    const cur_day = moment().startOf('day');

    const date_from = (moment(_query.date_from) < cur_day) ? cur_day : moment(_query.date_from);
    const date_till = moment(_query.date_till);

    if(date_till < cur_day){
      ctx.status = 403;
      ctx.error = true;
      ctx.body = `Дата окончания меньше текущей`;
      return;
    }

    const rem = await reminder({params: {ref: `run,${date_from.format('YYYYMMDD')},${date_till.format('YYYYMMDD')}`}}, false, true);

    if(rem.length) {
      const docs = new Map();
      const arrDocs = [];

      rem.forEach((elm) => {
        const {date, key} = elm;
        const realDate = date.toString();

        if (!docs.has(realDate)) {
          docs.set(realDate, new Map());
        }
        const mapDate = docs.get(realDate);
        const hasDoc = mapDate.has(key);

        const doc = (hasDoc) ? mapDate.get(key) : $p.doc.work_centers_task.create({date, key}, false, true);

        if (!hasDoc) {
          arrDocs.push(doc);
          mapDate.set(key, doc);
        }
        doc.planning.add(Object.assign({performance: elm.total}, elm.allkey));
      })

      const res = await save_array(arrDocs, true);
      ctx.body = Object.assign(res,
        {message: (res.err) ? 'Произошла ошибка при записи. Записано ' + res.count + ' заданий из ' + arrDocs.length : 'Записано ' + res.count + ' заданий'});
    }
    else {
      ctx.body = {count: 0, message:'Нет плановых данных для формирований заданий'};
    }
  }

  async function save_array(arrDocs, post, operational) {
    const count = arrDocs.length;

    return new Promise((resolve, reject) => {
      //Выстраиваем цепочку promise для последовательной записи
      arrDocs.reduce(function (doc_promise, doc, index) {
        return doc_promise.then(function () {
          //проверяем наличие вложений индивидуально для каждого объекта массива
          const attachments = ('attachments' in doc) ? doc.attachments : undefined;

          if (index == count - 1) {
            //В последний promise вставляем разрешение головного promise функции
            return doc.save(post, operational, attachments).then(() => {
              resolve({err: false, count})
            });
          }
          else {
            return doc.save(post, operational, attachments);
          }
        })
          .catch((result) => {
            reject({err: true, 'count': index, result:result});
          })
        //последний аргумент - начальное значение, т.е. первый promise, под которым пойдут остальные
      }, Promise.resolve());
    })
  }


  return async (req, res) => {

    const {path, paths} = req.parsed;

    try {
      switch (paths[3]) {
      case 'doc.calc_order':
        return await calc_order(ctx, next);

      case 'create_work_centers_tasks':
        return await create_work_centers_tasks(ctx, next);

      default:
        end.end404(res, path);
      }
    }
    catch (err) {
      end.end500({res, err, log});
    }

  };
}





