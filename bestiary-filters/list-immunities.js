import {
	listMonstersByDamageDefense,
	parseDamageTypeArgs,
	printNameCrList,
} from "./monster-filters.js";

const {damageType, includeSource} = parseDamageTypeArgs(process.argv, "list-immunities.js");
const rows = listMonstersByDamageDefense("immune", damageType);
printNameCrList(rows, {includeSource});
