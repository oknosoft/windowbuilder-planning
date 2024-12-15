
/**
 * Обработчик запросов к фиду ключей планирования
 * @param {MetaEngine} $p
 * @param {Function} log
 * @param {Accumulation} acc
 * @return Function
 */
function pgFeed($p, log, acc) {
  const {end500} = $p.utils.end;

  return async (req, res) => {
    try{
      const {query} = req;
      const results = [];
      const pq = await acc.client.query(query.include_docs === 'true' ?
          `select case when characteristics.ref  is null then keys.obj else characteristics.calc_order end calc_order, feed.seq, keys.*
from feed inner join keys on feed.ref = keys.ref
left outer join characteristics on characteristics.ref = keys.obj where seq > $1 limit $2` :
          `select * from feed where seq > $1 limit $2`, [query.since || 0, query.limit || 100]);
      const last_seq = pq.rowCount ? pq.rows[pq.rowCount - 1].seq : query.since || 0;
      if(pq.rowCount) {
        for(const {ref, seq, barcode, ...other} of pq.rows) {
          results.push({
            id: `pb|${ref}`,
            doc: {_id: 0, _rev: 0, id: barcode, ...other},
          });
        }
      }
      res.end(JSON.stringify({ok: true, results, last_seq}, null, '\t'));
    }
    catch (err) {
      end500({req, res, err, log});
    }
  };
}

module.exports = pgFeed;
