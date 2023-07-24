
module.exports = function planning_needs($p, log, route) {

  if(process.env.PLANNING_NEEDS) {
    $p.md.once('planning_keys', ({subscription, accumulation}) => {
      const {client} = accumulation;
      subscription.listeners.push(async function reflect({db, results, docs, branch, abonent, year}) {
        for(const {doc, prod} of docs) {

        }
      });
    });
  }

}
