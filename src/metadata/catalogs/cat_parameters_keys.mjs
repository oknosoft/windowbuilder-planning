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
        const all_keys = $p.cat.parameters_keys.find_rows(Object.assign({"is_folder":false}, "applying" in params ? {"applying": params.applying} : {});
        const p_params = {};
        const enum_comp = $p.enm.comparison_types;

        //Каждый переданный параметр ищем в job_prm.properties (в нем есть все свойства с синонимами, только по ним делаем поиск)
        for (const param in params) {
          if (param in $p.job_prm.properties) {
            //запоминаем свойство, его ref (чтобы работал поиск по табличной части) и значение параметра
            p_params[$p.job_prm.properties[param].ref] = {obj:$p.job_prm.properties[param], value:params[param]};
          }
        }

        const res = [];

        all_keys.forEach(function (key, i, all_keys){
          let good = true;

          //Берем строки табличной части ключа с отбором по свойствам, по которым у нас запрошены ключи
          const strings = key.params.find_rows({"property":{"in":Object.keys(p_params)}});

          strings.forEach(function (s, i_string, strings){
            //Выполняем сравнение
            good = (good && $p.utils.check_compare(p_params[s.property].value, p_params[s.property].obj.extract_value(s.comparison_type, s.txt_row, s.value), s.comparison_type, enum_comp));
          })
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
