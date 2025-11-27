
// SELECT * FROM JSON_TABLE ('[{"id": 1}]'::json, '$' COLUMNS (id INT PATH '$.id'))

module.exports = async function({doc, client, utils, job_prm, wsql}) {
  const register = doc.ref;
  const register_type = doc.class_name;
  const period = utils.moment(doc.date).format('YYYY-MM-DD HH:mm:ss');
  const {demands, production_kinds} = await getDemands({doc, job_prm, wsql});
  if(!demands.length) {
    return Promise.resolve();
  }
  const credit = [];
  const debit = [];
  for(const [production_kind, {stages, sequence}] of production_kinds) {
    for(const row of sequence.evalForward({demands, date: doc.date})) {
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
  const production_kinds = new Map();
  for (const row of doc.production) {
    const {characteristic: cx} = row;
    // для всех продукций заказа с непустым видом производства
    if (cx.calc_order === doc) {
      const {production_kind} = cx.sys;
      if(!production_kind.empty()) {
        const {allStages} = production_kind;
        if(!production_kinds.has(production_kind)) {
          production_kinds.set(production_kind, new Set());
        }
        // в разрезе видов производства
        const stages = production_kinds.get(production_kind);
        // для строк спецификации с заполненным этапом, если таковой есть в видах производства
        for (const sprow of cx.specification) {
          const {stage, dop} = sprow;
          if (!stage.empty() && dop <= -4 && allStages.includes(stage)) {
            const drow = sprow.nom.demand.find({kind: stage});
            stages.add(stage);
            // для всех экземпляров
            for (let specimen = 1; specimen <= row.quantity; specimen++) {
              const demand = {
                obj: cx.ref,
                specimen,
                elm: 0,
                region: 0,
                stage: stage.ref,
                production_kind,
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
    for(const [production_kind, stages] of production_kinds) {
      production_kinds.set(production_kind, {stages, sequence: production_kind.sequence(stages)});
    }
    const tmp = wsql.alasql(`select obj, specimen, elm, region, stage, production_kind, sum(totqty) totqty
from ? group by obj, specimen, elm, region, stage, production_kind`, [demands]);
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
  return {demands, production_kinds};
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
where phase = 'plan'
and date between $1 and $2
and work_center in (${wc.join(',')})) raw
group by date, shift, work_center
having sum(power) > 0
order by date`;
  const res = await client.query(sql, [from, to]);
  return res.rows
    .filter(row => row.date >= workCenters.get(row.work_center))
    .map(({date, power, ...v}) => ({...v, power: parseFloat(power), date: utils.moment(date).format('YYYY-MM-DD')}));
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
