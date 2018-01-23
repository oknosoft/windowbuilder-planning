// модификаторы справочников

// права пользователей
//import cat_users_acl from "./cat_users_acl";

//справочник Направления доставки
import cat_delivery_directions from "./cat_delivery_directions";
//Справочник Характеристики номенклатуры
import cat_characteristics from "./cat_characteristics";
//Справочник Признаки нестандартов
import cat_nonstandard_attributes from "./cat_nonstandard_attributes";
//Справочник Ключи параметров
import cat_parameters_keys from "./cat_parameters_keys";

export default function ($p) {
  cat_characteristics($p)
  cat_delivery_directions($p);
  cat_nonstandard_attributes($p);
  cat_parameters_keys($p);
}
