// модификаторы справочников

// права пользователей
//import cat_users_acl from "./cat_users_acl";

//справочник Направления доставки
import cat_delivery_directions from "./cat_delivery_directions";
import cat_characteristics from "./cat_characteristics";

export default function ($p) {
	//cat_users_acl($p);
  cat_characteristics($p)
  cat_delivery_directions($p);
}
