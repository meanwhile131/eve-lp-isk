const corp_select = document.getElementById("corp_select");
const table = document.getElementById("offers");
const adjusted_price_checkbox = document.getElementById("adjusted_price");

const corps = await (await fetch("https://esi.evetech.net/corporations/npccorps")).json();
/** @type {Array} */
const prices_raw = await (await fetch("https://esi.evetech.net/markets/prices")).json();

function calculate_prices() {
	const prices = new Map();
	prices_raw.forEach(rawPrice => {
		prices[rawPrice.type_id] = adjusted_price_checkbox.checked ? rawPrice.adjusted_price : rawPrice.average_price;
	});
	return prices;
}
let prices = calculate_prices();


corps.forEach(corp_id => {
	const corp_option = document.createElement("option");
	corp_option.innerText = corp_id;
	corp_select.appendChild(corp_option);
});
corp_select.value = localStorage.getItem("corporation");

/**
 * @typedef {Object} Offer
 * @property {Array} required_items
 */
/**
 * @param {Offer} offer
 */
function get_isk_per_lp(offer) {
	const result_value = prices[offer.type_id] * offer.quantity;
	let required_items_value = 0;
	offer.required_items.forEach(required_item => {
		const item_value = prices[required_item.type_id] * required_item.quantity;
		required_items_value += item_value;
	});
	const isk_profit = result_value - required_items_value - offer.isk_cost;
	const isk_per_lp = isk_profit / offer.lp_cost;
	return isk_per_lp;
}

corp_select.addEventListener("change", async e => {
	localStorage.setItem("corporation", e.target.value);
	update_table();
});
adjusted_price_checkbox.addEventListener("change", async () => {
	prices = calculate_prices();
	update_table();
});
async function update_table() {
	const corporation_id = corp_select.value;
	table.innerHTML = "";
	if (!corporation_id) return;

	/** @type {[Offer]} */
	const offers = await (await fetch(`https://esi.evetech.net/loyalty/stores/${corporation_id}/offers`)).json();

	offers.sort((a, b) => get_isk_per_lp(b) - get_isk_per_lp(a));
	offers.forEach(offer => {
		let row = document.createElement("tr");
		let rowspan = Math.max(offer.required_items.length, 1);
		function insertCell(text) {
			const cell = row.insertCell();
			cell.innerText = text;
			cell.rowSpan = rowspan;
		}
		insertCell(offer.type_id);
		insertCell(offer.quantity);
		insertCell(offer.lp_cost);
		insertCell(offer.isk_cost);

		if (offer.required_items.length == 0) {
			row.insertCell();
			row.insertCell();
			insertCell(get_isk_per_lp(offer));
		}
		offer.required_items.forEach((required_item, i) => {
			if (i > 0) {
				table.appendChild(row);
				row = document.createElement("tr");
			}
			row.insertCell().innerText = required_item.type_id;
			row.insertCell().innerText = required_item.quantity;
			if (i == 0) {
				insertCell(get_isk_per_lp(offer));
			}
		});
		table.appendChild(row);
	});
}
update_table();
