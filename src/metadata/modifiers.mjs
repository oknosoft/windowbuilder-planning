// модификаторы объектов и менеджеров данных

// // модификаторы справочников
// import catalogs from './catalogs';

// // модификаторы документов
// import documents from './documents';

// // модификаторы планов видов характеристик
import chartscharacteristics from './chartscharacteristics';

// // модификаторы отчетов
import reports from './reports/index';

// общие модули
import common from './common/index';


export default function ($p) {
  // catalogs($p);
  // documents($p);
  chartscharacteristics($p);
  reports($p);
  common($p);
}
