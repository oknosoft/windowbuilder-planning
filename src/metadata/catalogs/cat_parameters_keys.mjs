/**
 * ### Дополнительные методы справочника Ключи параметров
 *
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2017
 *
 * @module cat_parameters_keys
 */

export default function ($p) {

  $p.cat.parameters_keys.__define({

    //Фукнция определения ключей параметров по параметрам
    keys_by_params: {
      value: function (params) {
        //Получаем все ключи, фильтрованные по применению (если оно указано) и отсеиваем группы
        const all_keys = $p.cat.parameters_keys.find_rows(Object.assign({"is_folder":false}, "applying" in params ? {"applying": params.applying} : {}));
        const p_params = {};
        const enum_comp = $p.enm.comparison_types;
        const {properties} = $p.job_prm.properties;


        //Каждый переданный параметр ищем в job_prm.properties (в нем есть все свойства с синонимами, только по ним делаем поиск)
        for (const param in params) {
          if (param in $p.job_prm.properties) {
            //запоминаем свойство, его ref (чтобы работал поиск по табличной части) и значение параметра
            p_params[properties[param].ref] = {obj:properties[param], value:params[param]};
          }
        }

        const res = [];

        all_keys.forEach((key)=>{
          let good = true;

          //Берем строки табличной части ключа с отбором по свойствам, по которым у нас запрошены ключи
          const strings = key.params.find_rows({"property":{"in":Object.keys(p_params)}}, (row)=>{
            good = (good && $p.utils.check_compare(p_params[row.property].value, p_params[row.property].obj.extract_value(row.comparison_type, row.txt_row, row.value), row.comparison_type, enum_comp));
          });

        if (good) {
          res.push(key);

          //Если передан параметр first, то нужен только первый ключ, поэтому сразу возвращаем
          if(params.first){
            return res;
          }
        }
      })
      return res;
      }
    }
  })
}
