/** @type {HTMLSelectElement} */
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
const names = new Map();


const new_names = await (await fetch("https://esi.evetech.net/universe/names", {method: "POST", body: JSON.stringify(Array.from(corps))})).json();
new_names.forEach(new_name => {
	names[new_name.id] = new_name.name;
});

corps.forEach(corp_id => {
	const corp_option = document.createElement("option");
	corp_option.innerText = names[corp_id];
	corp_option.value = corp_id;
	corp_select.appendChild(corp_option);
});

if (window.location.hash) {
	corp_select.value = window.location.hash.slice(1);
}
else {
	corp_select.value = localStorage.getItem("corporation");
	window.location.hash = corp_select.value;
}

window.addEventListener("hashchange", () => {
	corp_select.value = window.location.hash.slice(1);
	update_table();
});

/**
 * @typedef {Object} Offer
 * @property {Array} required_items
 * @property {number} isk_cost
 * @property {number} lp_cost
 * @property {number} offer_id
 * @property {number} quantity
 * @property {number} type_id
 */
/** @param {Offer} offer */
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
	window.location.hash = e.target.value;
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
	const needed_names = new Set();

	function add_if_missing(type_id) {
		if (!names.has(type_id)) {
			needed_names.add(type_id);
		}
	}
	offers.forEach(offer => {
		add_if_missing(offer.type_id);
		offer.required_items.forEach(required_item => {
			add_if_missing(required_item.type_id);
		});
	});
	if (needed_names.size > 0) {
		const new_names = await (await fetch("https://esi.evetech.net/universe/names", {method: "POST", body: JSON.stringify(Array.from(needed_names))})).json();
		new_names.forEach(new_name => {
			names[new_name.id] = new_name.name;
		});
	}

	offers.sort((a, b) => get_isk_per_lp(b) - get_isk_per_lp(a));
	offers.forEach(offer => {
		let row = document.createElement("tr");
		let rowspan = Math.max(offer.required_items.length, 1);
		function insertImgCell(type_id, rowspan) {
			const img = document.createElement("img");
			img.src = `https://images.evetech.net/types/${type_id}/icon`;
			const cell = row.insertCell();
			cell.appendChild(img);
			cell.rowSpan = rowspan;
		}
		function insertCell(text) {
			const cell = row.insertCell();
			cell.innerText = text;
			cell.rowSpan = rowspan;
		}
		insertImgCell(offer.type_id, rowspan);
		insertCell(names[offer.type_id]);
		insertCell(offer.quantity.toLocaleString());
		insertCell(offer.lp_cost.toLocaleString());
		insertCell(offer.isk_cost.toLocaleString());
		insertCell(prices[offer.type_id].toLocaleString());

		if (offer.required_items.length == 0) {
			for (let i = 0; i < 4; i++)
				row.insertCell();
			insertCell(get_isk_per_lp(offer).toLocaleString());
		}
		offer.required_items.forEach((required_item, i) => {
			if (i > 0) {
				table.appendChild(row);
				row = document.createElement("tr");
			}
			insertImgCell(offer.type_id, 1);
			row.insertCell().innerText = names[required_item.type_id];
			row.insertCell().innerText = required_item.quantity.toLocaleString();
			row.insertCell().innerText = prices[required_item.type_id].toLocaleString();
			if (i == 0) {
				insertCell(get_isk_per_lp(offer).toLocaleString());
			}
		});
		table.appendChild(row);
	});
}
update_table();
