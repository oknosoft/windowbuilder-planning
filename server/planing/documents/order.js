
// SELECT * FROM JSON_TABLE ('[{"id": 1}]'::json, '$' COLUMNS (id INT PATH '$.id'))

module.exports = async function({doc, client, utils, job_prm, wsql}) {
  const register = doc.ref;
  const register_type = doc.class_name;
  const period = utils.moment(doc.date).format('YYYY-MM-DD HH:mm:ss');
  const demands = await getDemands({doc, job_prm, wsql});
  if(!demands.length) {
    return Promise.resolve();
  }
  const credit = [];
  const debit = [];
  const rm = [];
  const closing = await getClosing({doc, client, utils});
  // если дата есть в закрытии, используем её (перепроведение)
  if(closing.length) {
    for(const demand of demands) {
      let power = demand.totqty;
      const crows = closing.filter(row => row.planing_key === demand.planing_key && row.stage === demand.stage);
      for(const row of crows) {
        power -= row.power;
        credit.push({
          date: row.date,
          shift: row.shift,
          work_center: row.work_center,
          power: row.power,
        });
        debit.push({
          sign: 1,
          phase: 'run',
          date: row.date,
          shift: row.shift,
          work_center: row.work_center,
          planing_key: row.planing_key,
          stage: row.stage,
          power: row.power,
        });
      }
      if(power <= 0.001) {
        rm.push(demand);
      }
      else {
        demand.totqty = power;
      }
    }
    for(const demand of rm) {
      demands.splice(demands.indexOf(demand), 1);
    }
  }

  // если даты нет в закрытии (штатный режим)
  if(demands.length) {
    const workCenters = getWorkCenters({demands, date: doc.date, utils, wsql});
    if(!workCenters.size) {
      return Promise.resolve();
    }
    const remainders = await getRemainders({workCenters, date: doc.date, client, utils, wsql});

    // TODO: если нет свободных рабцентров...
    for(const demand of demands) {
      for(const remainder of remainders) {
        if(demand.totqty <= remainder.power) {
          remainder.power -= demand.totqty;
          credit.push({
            date: remainder.date,
            shift: remainder.shift,
            work_center: remainder.work_center,
            power: demand.totqty,
          });
          debit.push({
            sign: 1,
            phase: 'run',
            date: remainder.date,
            shift: remainder.shift,
            work_center: remainder.work_center,
            planing_key: demand.planing_key,
            stage: demand.stage,
            power: demand.totqty,
          });
          break;
        }
      }
    }
  }

  const grouped = wsql.alasql('select date, shift, work_center, sum(power) power from ? group by date, shift, work_center', [credit]);

  const creditValues = grouped.map((v, index) => `('${register}', '${register_type}', ${index + 1}, '${period
  }', -1, '${v.date}', '${v.shift}', '${v.work_center}', ${v.power})`);
  const {length} = grouped;
  const debitValues = debit.map((v, index) => `('${register}', '${register_type}', ${length + index + 1}, '${period
  }', 'run', '${v.date}', '${v.shift}', '${v.work_center}', ${v.planing_key}, '${v.stage}', '${register}', '${register_type}', '${register}', ${v.power})`);

  let sql = creditValues.length ? `INSERT INTO areg_dates (register, register_type, row_num, period, sign, date, shift, work_center, power) VALUES ${creditValues.join(',\n')};\n` : '';
  if(debitValues.length) {
    sql += `INSERT INTO areg_dates (register, register_type, row_num, period, phase, date, shift, work_center, planing_key, stage, part, part_type, calc_order, power) VALUES ${debitValues.join(',\n')}`;
  }

  return sql ? client.query(sql) : Promise.resolve();
};

/**
 * Рассчитывает потребности с ключами и этапами + сдвиг от даты заказа
 * @param {DocCalc_order} doc
 * @param {JobPrm} job_prm
 * @param {Wsql} wsql
 * @return {Promise<Array>}
 */
async function getDemands({doc, job_prm, wsql}) {
  const demands = [];
  for (const row of doc.production) {
    const {characteristic: cx} = row;
    // для всех продукций заказа с непустым видом производства
    if (cx.calc_order === doc && !cx.sys.production_kind.empty()) {
      const {stages} = cx.sys.production_kind;
      // для всех экземпляров
      for (let specimen = 1; specimen <= row.quantity; specimen++) {
        // для строк спецификации с заполненным этапом, если таковой есть в видах производства
        for (const sprow of cx.specification) {
          const {stage} = sprow;
          if (!stage.empty() && stages.find({stage})) {
            const drow = sprow.nom.demand.find({kind: stage});
            if(drow) {
              const demand = {
                obj: cx.ref,
                specimen,
                elm: 0,
                region: 0,
                stage: stage.ref,
                days_from: drow.days_from_execution,
                days_to: drow.days_to_execution,
                totqty: sprow.totqty,
              };
              // учтём детализацию планирования
              if(stage.applying.is('elm') || stage.applying.is('region')) {
                demand.elm = sprow.elm;
              }
              if(stage.applying.is('region')) {
                demand.region = sprow.region;
              }
              demands.push(demand);
            }
          }
        }
      }
    }
  }
  if(demands.length) {
    const tmp = wsql.alasql(`select obj, specimen, elm, region, stage, max(days_from) days_from, max(days_to) days_to, sum(totqty) totqty
from ? group by obj, specimen, elm, region, stage`, [demands]);
    demands.length = 0;
    demands.push(...tmp);
    const keys = wsql.alasql(`select distinct obj, specimen, elm, region from ?`, [demands]);
    await job_prm.planning_keys(keys);
    for(const arow of demands) {
      const krow = keys.find((key) =>
        key.obj === arow.obj && key.specimen === arow.specimen && key.elm === arow.elm && key.region === arow.region);
      if(krow) {
        arow.planing_key = parseInt(krow.barcode);
      }
    }
  }
  return demands;
}

/**
 * Ищет рабочие центры, на которых можно выполнить этапы
 * @param demands
 * @param date
 * @param utils
 * @param wsql
 * @return {Map<String, Number>}
 */
function getWorkCenters({demands, date, utils, wsql}) {
  const res = new Map();
  const {work_centers} = wsql.$p.cat;
  const tmp = wsql.alasql(`select stage, max(days_to) days_to from ? group by stage`, [demands]);
  for(const {stage, days_to} of tmp) {
    for(const work_center of work_centers) {
      if(work_center.work_center_kinds.find({kind: stage})) {
        if(!res.has(work_center.ref) || (res.get(work_center.ref) < days_to)) {
          res.set(work_center.ref, days_to);
        }
      }
    }
  }
  for(const [ref, shift] of res) {
    const start = shift ? utils.date_add_day(date, shift) : date;
    start.setHours(0, 0, 0, 0);
    res.set(ref, start);
  }
  return res;
}

async function getRemainders({workCenters, date, client, utils, wsql}) {
  const {work_centers, work_shifts} = wsql.$p.cat;
  const wc = []
  const always = [];
  for(const work_center of workCenters.keys()) {
    const curr = work_centers.get(work_center);
    if(curr.available) {
      const start = workCenters.get(work_center);
      for(const shift of work_shifts) {
        if(!shift.predefined_name) {
          for(let i = 0; i < 7; i++) {
            const time = utils.moment(date).set({hour: 0, minute: 0, second: 0}).add(i, 'day');
            if(time.toDate() >= start) {
              always.push({
                date: time.format('YYYY-MM-DD'),
                shift: shift.ref,
                work_center,
                power: 1e6,
              })
            }
          }
        }
      }
    }
    else {
      wc.push(`'${work_center}'`);
    }
  }

  if(wc.length) {
    const from = utils.moment(date).format('YYYY-MM-DD');
    const to = utils.moment(date).add(20, 'days').format('YYYY-MM-DD');
    const sql = `select date, shift, work_center, sum(power) power from
(SELECT date, shift, work_center, sign * power power FROM public.areg_dates
where phase = 'plan'
and date between $1 and $2
and work_center in (${wc.join(',')})) raw
group by date, shift, work_center
having sum(power) > 0
order by date`;
    const res = await client.query(sql, [from, to]);
    return res.rows
      .filter(row => row.date >= workCenters.get(row.work_center))
      .map(({date, power, ...v}) => ({...v, power: parseFloat(power), date: utils.moment(date).format('YYYY-MM-DD')}))
      .concat(always);
  }
  else {
    return always;
  }
}

async function getClosing({doc: {ref, class_name}, client, utils}) {
  //const wc = Array.from(workCenters.keys()).map(v => `'${v}'`);
  const sql = `SELECT * FROM public.areg_dates
where phase = 'run' and part = '${ref}' and part_type = '${class_name}' and sign = -1`; // and work_center in (${wc.join(',')})
  const res = await client.query(sql);
  for(const row of res.rows) {
    row.planing_key = parseInt(row.planing_key, 10);
    row.row_num = parseInt(row.row_num, 10);
    row.power = parseFloat(row.power);
    row.date = utils.moment(row.date).format('YYYY-MM-DD');
  }
  return res.rows;
}
