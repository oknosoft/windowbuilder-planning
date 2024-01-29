
module.exports = async function({doc, client, utils, job_prm, wsql}) {
  const register = doc.ref;
  const register_type = doc.class_name;
  const period = utils.moment(doc.date).format('YYYY-MM-DD HH:mm:ss');
  const demands = await getDemands({doc, job_prm, wsql});
  if(!demands.length) {
    return Promise.resolve();
  }
  const workCenters = getWorkCenters({demands, date: doc.date, utils, wsql});
  if(!workCenters.size) {
    return Promise.resolve();
  }
  const remainders = await getRemainders({workCenters, date: doc.date, client, utils});

  const credit = [];
  const debit = [];
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
  const creditValues = credit.map((v, index) => `('${register}', '${register_type}', ${index + 1}, '${period
  }', -1, '${v.date}', '${v.shift}', '${v.work_center}', ${v.power})`);
  const {length} = credit;
  const debitValues = debit.map((v, index) => `('${register}', '${register_type}', ${length + index + 1}, '${period
  }', 'run', '${v.date}', '${v.shift}', '${v.work_center}', ${v.planing_key}, '${v.stage}', '${register}', ${v.power})`);

  const sql = `INSERT INTO areg_dates (register, register_type, row_num, period, sign, date, shift, work_center, power) VALUES ${creditValues.join(',\n')};

INSERT INTO areg_dates (register, register_type, row_num, period, phase, date, shift, work_center, planing_key, stage, calc_order, power) VALUES ${debitValues.join(',\n')}`;

  return client.query(sql);
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

async function getRemainders({workCenters, date, client, utils}) {
  const wc = Array.from(workCenters.keys()).map(v => `'${v}'`);
  const from = utils.moment(date).format('YYYY-MM-DD');
  const to = utils.moment(date).add(20, 'days').format('YYYY-MM-DD');
  const sql = `select date, shift, work_center, sum(power) power from
(SELECT date, shift, work_center, sign * power power FROM public.areg_dates
where phase = $1
and date between $2 and $3
and work_center in (${wc.join(',')})) raw
group by date, shift, work_center
having sum(power) > 0
order by date`;
  const res = await client.query(sql, ['plan', from, to]);
  return res.rows
    .filter(row => row.date >= workCenters.get(row.work_center))
    .map(({date, ...v}) => ({...v, date: utils.moment(date).format('YYYY-MM-DD')}));
}
