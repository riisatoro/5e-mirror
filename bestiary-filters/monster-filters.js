import fs from "fs";
import * as path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

export const DMG_TYPES = [
	"acid",
	"bludgeoning",
	"cold",
	"fire",
	"force",
	"lightning",
	"necrotic",
	"piercing",
	"poison",
	"psychic",
	"radiant",
	"slashing",
	"thunder",
];

const CR_ORDER = {
	"0": 0,
	"1/8": 0.125,
	"1/4": 0.25,
	"1/2": 0.5,
};

/**
 * @param {unknown} cr
 * @returns {string}
 */
export function getCrDisplay (cr) {
	if (cr == null) return "—";
	if (typeof cr === "object") return String(cr.cr ?? "—");
	return String(cr);
}

/**
 * @param {unknown} cr
 * @returns {number}
 */
export function getCrNumber (cr) {
	const raw = typeof cr === "object" && cr ? cr.cr : cr;
	if (raw == null) return Number.POSITIVE_INFINITY;
	const s = String(raw);
	if (Object.prototype.hasOwnProperty.call(CR_ORDER, s)) return CR_ORDER[s];
	const n = Number(s);
	return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

/**
 * Flatten resist/immune arrays into damage-type strings (mirrors FilterCommon).
 * @param {unknown} val
 * @param {"resist"|"immune"} key
 * @returns {string[]}
 */
export function flattenImmRes (val, key) {
	if (!val) return [];
	const out = [];
	for (const valSub of val) flattenImmResRecurse(valSub, key, out);
	return out;
}

function flattenImmResRecurse (val, key, out, isConditional = false) {
	if (val && typeof val === "object" && val[key]) {
		for (const nxt of val[key]) flattenImmResRecurse(nxt, key, out, !!val.cond);
		return;
	}
	if (val?.special) {
		out.push("other");
		return;
	}
	if (typeof val !== "string") return;
	out.push(isConditional ? `${val} (conditional)` : val);
}

/**
 * @param {string[]} types
 * @param {string} damageType
 */
export function hasDamageType (types, damageType) {
	const want = damageType.trim().toLowerCase();
	return types.some(t => {
		const base = t.toLowerCase().replace(/\s*\(conditional\)\s*$/i, "").trim();
		return base === want || t.toLowerCase() === want;
	});
}

function loadJson (filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

/**
 * Load monsters from bestiary files, skipping excluded sources.
 * @returns {{name: string, source: string, cr: unknown, resist?: unknown, immune?: unknown}[]}
 */
export function loadAvailableMonsters () {
	const index = loadJson(path.join(ROOT, "data", "bestiary", "index.json"));
	const excluded = new Set(
		(loadJson(path.join(ROOT, "excluded-sources.json")).sources || [])
			.map(s => String(s.source).toLowerCase()),
	);

	const monsters = [];
	for (const [source, fileName] of Object.entries(index)) {
		if (excluded.has(String(source).toLowerCase())) continue;
		const filePath = path.join(ROOT, "data", "bestiary", fileName);
		if (!fs.existsSync(filePath)) continue;
		const data = loadJson(filePath);
		for (const mon of data.monster || []) {
			if (excluded.has(String(mon.source || source).toLowerCase())) continue;
			monsters.push(mon);
		}
	}
	return monsters;
}

/**
 * @param {"resist"|"immune"} prop
 * @param {string} damageType
 * @returns {{name: string, cr: string, source: string, types: string[]}[]}
 */
export function listMonstersByDamageDefense (prop, damageType) {
	const want = damageType.trim().toLowerCase();
	if (!want) throw new Error("Damage type is required.");

	const rows = [];
	for (const mon of loadAvailableMonsters()) {
		const types = flattenImmRes(mon[prop], prop);
		if (!hasDamageType(types, want)) continue;
		rows.push({
			name: mon.name,
			cr: getCrDisplay(mon.cr),
			source: mon.source,
			types,
		});
	}

	rows.sort((a, b) => {
		const crDiff = getCrNumber(a.cr) - getCrNumber(b.cr);
		if (crDiff !== 0) return crDiff;
		return a.name.localeCompare(b.name, "en", {sensitivity: "base"});
	});

	return rows;
}

/**
 * @param {{name: string, cr: string, source: string}[]} rows
 * @param {{includeSource?: boolean}} [opts]
 */
export function printNameCrList (rows, {includeSource = false} = {}) {
	for (const row of rows) {
		const src = includeSource ? `\t${row.source}` : "";
		console.log(`${row.name}\tCR ${row.cr}${src}`);
	}
	console.error(`Total: ${rows.length}`);
}

/**
 * Parse CLI args for the list scripts.
 * @param {string[]} argv
 * @param {string} scriptName
 */
export function parseDamageTypeArgs (argv, scriptName) {
	const args = argv.slice(2).filter(a => a !== "--");
	const includeSource = args.includes("--source");
	const positional = args.filter(a => !a.startsWith("-"));
	const damageType = positional[0];

	if (!damageType || damageType === "--help" || args.includes("-h") || args.includes("--help")) {
		console.error(`Usage: node bestiary-filters/${scriptName} <damageType> [--source]`);
		console.error(`Damage types: ${DMG_TYPES.join(", ")}`);
		process.exit(damageType ? 0 : 1);
	}

	return {damageType, includeSource};
}
