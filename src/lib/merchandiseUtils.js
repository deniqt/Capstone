// Put this file at: src/lib/merchandiseUtils.js
//
// Shared helpers so AdminPayment and AdminReport identify and count
// merchandise sales in exactly the same way.
//
// Sales are saved in payments.service as text:
//   new format:    "Tutorial Shirt [Size M] (x2)"
//   legacy format: "T-shirt", "Notebooks (x3)", "Tutorial Shirt (x2)"

// "(x3)" -> 3, otherwise 1
export function getQty(service) {
    const match = String(service || "").match(/\(x(\d+)\)/i);
    return match ? parseInt(match[1], 10) : 1;
}

// "[Size M]" or "[M]" -> "m", otherwise null
export function getSizeTag(service) {
    const match = String(service || "").match(/\[(?:size\s*)?([^\]]+)\]/i);
    return match ? match[1].trim().toLowerCase() : null;
}

// Reduces a name to a comparable key. "T-shirt", "Tutorial Shirt" and
// "Tutorial Shirt [Size M] (x2)" all become "shirt". Notebooks likewise.
function baseKey(text) {
    const cleaned = String(text || "")
        .toLowerCase()
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\(x\d+\)/gi, "")
        .trim();

    if (cleaned.includes("shirt")) return "shirt";
    if (cleaned.includes("notebook")) return "notebook";

    return cleaned;
}

// Builds the text stored in payments.service for a merchandise sale
export function formatMerchService(item, qty) {
    const sizePart = item.size ? ` [Size ${item.size}]` : "";
    const qtyPart = qty > 1 ? ` (x${qty})` : "";

    return `${item.name}${sizePart}${qtyPart}`;
}

// Is this service text a merchandise item?
export function isMerchService(service, catalog = []) {
    const key = baseKey(service);

    if (!key) return false;
    if (key === "shirt" || key === "notebook") return true;

    return catalog.some(item => {
        const itemKey = baseKey(item.name);
        return itemKey && (key === itemKey || key.startsWith(itemKey));
    });
}

// Does this payment's service text belong to this specific catalog row?
// Rows that share a name (for example shirt sizes) are told apart by the
// [Size X] tag. Legacy sales with no size tag go to size M, or to the
// first row of the group if there is no M.
export function matchItemToPayment(item, service, catalog = []) {
    const key = baseKey(service);
    const itemKey = baseKey(item.name);

    if (!key || !itemKey) return false;
    if (key !== itemKey && !key.startsWith(itemKey)) return false;

    const group = catalog.filter(m => baseKey(m.name) === itemKey);

    if (group.length <= 1) return true;

    const tag = getSizeTag(service);
    const itemSize = String(item.size || "").trim().toLowerCase();

    if (tag) return itemSize === tag;

    const fallback =
        group.find(m => String(m.size || "").trim().toLowerCase() === "m") ||
        group[0];

    return fallback.id === item.id;
}

// A merchandise sale is a walk-in sale (no student) of a merchandise item
export function isMerchandisePayment(payment, catalog = []) {
    if (payment.student_id) return false;

    return isMerchService(payment.service, catalog);
}