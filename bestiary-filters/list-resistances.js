import {
	listMonstersByDamageDefense,
	parseDamageTypeArgs,
	printNameCrList,
} from "./monster-filters.js";

const {damageType, includeSource} = parseDamageTypeArgs(process.argv, "list-resistances.js");
const rows = listMonstersByDamageDefense("resist", damageType);
printNameCrList(rows, {includeSource});
