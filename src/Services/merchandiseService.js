// ==========================================================================
// MERCHANDISE & INVENTORY SERVICE
// Manages official physical merchandise catalog, stock levels, and POS item data
// Official Merchandise per Center Rate Sheet: Tutorial Shirt (₱300 across all sizes) & Tutorial Notebook (₱80)
// ==========================================================================

const STORAGE_KEY = "yosef_merchandise_catalog";

export const DEFAULT_MERCHANDISE = [
    {
        id: "merch-shirt-xs",
        name: "Tutorial Shirt (XS)",
        category: "Apparel",
        size: "XS",
        price: 300,
        stock: 15,
        description: "Official Yosef tutorial center shirt with logo - Size Extra Small",
        createdAt: "2026-10-01"
    },
    {
        id: "merch-shirt-s",
        name: "Tutorial Shirt (S)",
        category: "Apparel",
        size: "S",
        price: 300,
        stock: 20,
        description: "Official Yosef tutorial center shirt with logo - Size Small",
        createdAt: "2026-10-01"
    },
    {
        id: "merch-shirt-m",
        name: "Tutorial Shirt (M)",
        category: "Apparel",
        size: "M",
        price: 300,
        stock: 25,
        description: "Official Yosef tutorial center shirt with logo - Size Medium",
        createdAt: "2026-10-01"
    },
    {
        id: "merch-shirt-l",
        name: "Tutorial Shirt (L)",
        category: "Apparel",
        size: "L",
        price: 300,
        stock: 20,
        description: "Official Yosef tutorial center shirt with logo - Size Large",
        createdAt: "2026-10-01"
    },
    {
        id: "merch-shirt-xl",
        name: "Tutorial Shirt (XL)",
        category: "Apparel",
        size: "XL",
        price: 300,
        stock: 10,
        description: "Official Yosef tutorial center shirt with logo - Size Extra Large",
        createdAt: "2026-10-01"
    },
    {
        id: "merch-notebook",
        name: "Tutorial Notebook",
        category: "Stationery",
        size: null,
        price: 80,
        stock: 120,
        description: "Official Yosef spiral tutorial notebook with lined practice sheets and center branding",
        createdAt: "2026-10-01"
    }
];

/**
 * Retrieves the current merchandise catalog from persistent storage.
 * Automatically migrates single generic shirt into size variants (all ₱300)
 * and purges non-official merchandise so only Tutorial Shirt sizes and Tutorial Notebook appear.
 */
export function getMerchandiseList() {
    try {
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        if (!stored) {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MERCHANDISE));
            }
            return DEFAULT_MERCHANDISE;
        }
        let parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MERCHANDISE));
            }
            return DEFAULT_MERCHANDISE;
        }

        // Filter out non-official mock items
        let filtered = parsed.filter(item => {
            const nameLower = (item.name || "").toLowerCase();
            if (item.id === "merch-3" || item.id === "merch-4") return false;
            if (nameLower.includes("starter kit") || nameLower.includes("tote bag")) return false;
            return true;
        });

        // Ensure all 5 official shirt sizes exist (XS, S, M, L, XL)
        const requiredShirtSizes = ["XS", "S", "M", "L", "XL"];
        const existingShirtSizes = new Set(
            filtered
                .filter(item => (item.category === "Apparel" || (item.name || "").toLowerCase().includes("shirt")))
                .map(item => {
                    if (item.size) return item.size.toUpperCase();
                    const match = (item.name || "").match(/\((XS|S|M|L|XL|2XL)\)/i);
                    return match ? match[1].toUpperCase() : null;
                })
                .filter(Boolean)
        );

        const missingShirts = DEFAULT_MERCHANDISE.filter(
            item => item.size && requiredShirtSizes.includes(item.size) && !existingShirtSizes.has(item.size)
        );

        if (missingShirts.length > 0) {
            filtered = [...filtered, ...missingShirts];
        }

        // Ensure notebook exists
        const hasNotebook = filtered.some(item => 
            item.id === "merch-notebook" || (item.name || "").toLowerCase().includes("notebook")
        );
        if (!hasNotebook) {
            const defaultNotebook = DEFAULT_MERCHANDISE.find(item => item.id === "merch-notebook");
            if (defaultNotebook) filtered.push(defaultNotebook);
        }

        // Check if legacy single-shirt catalog needs replacement
        const hasShirtVariants = filtered.some(item => 
            (item.name || "").toLowerCase().includes("shirt") && (item.size || item.name.includes("("))
        );

        if (!hasShirtVariants) {
            const nonShirtItems = filtered.filter(item => 
                !(item.name || "").toLowerCase().includes("shirt") && item.id !== "merch-1"
            );
            const shirtVariants = DEFAULT_MERCHANDISE.filter(item => item.category === "Apparel");
            filtered = [...shirtVariants, ...nonShirtItems];
        }

        // Normalize notebook and ensure shirts stay ₱300 with proper category
        const normalized = filtered.map(item => {
            const nameLower = (item.name || "").toLowerCase();
            if (item.category === "Apparel" || nameLower.includes("shirt")) {
                let size = item.size;
                if (!size) {
                    const match = item.name.match(/\((XS|S|M|L|XL|2XL)\)/i);
                    if (match) size = match[1].toUpperCase();
                }
                return {
                    ...item,
                    category: "Apparel",
                    size: size || null,
                    price: 300, // all shirt sizes always ₱300 per official fee rate sheet
                    description: item.description || `Official Yosef tutorial center shirt with logo${size ? ` - Size ${size}` : ""}`
                };
            }
            if (item.id === "merch-2" || item.id === "merch-notebook" || nameLower.includes("notebook")) {
                return {
                    ...item,
                    id: item.id || "merch-notebook",
                    name: "Tutorial Notebook",
                    category: "Stationery",
                    size: null,
                    price: 80,
                    description: item.description || "Official Yosef spiral tutorial notebook with lined practice sheets and center branding"
                };
            }
            return item;
        });

        // Ensure canonical sort order: XS, S, M, L, XL shirts, then Notebook
        const sizeOrder = { XS: 1, S: 2, M: 3, L: 4, XL: 5 };
        normalized.sort((a, b) => {
            if (a.category === "Apparel" && b.category === "Apparel") {
                return (sizeOrder[a.size] || 99) - (sizeOrder[b.size] || 99);
            }
            if (a.category === "Apparel") return -1;
            if (b.category === "Apparel") return 1;
            return (a.name || "").localeCompare(b.name || "");
        });

        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        }
        return normalized;
    } catch (error) {
        console.error("Error reading merchandise catalog:", error);
        return DEFAULT_MERCHANDISE;
    }
}

/**
 * Saves or updates a merchandise product in the catalog.
 */
export function saveMerchandiseItem(item) {
    try {
        const list = getMerchandiseList();
        if (item.id) {
            // Update existing
            const index = list.findIndex(m => m.id === item.id);
            if (index !== -1) {
                list[index] = {
                    ...list[index],
                    ...item,
                    size: item.size || null,
                    price: Number(item.price) || 0,
                    stock: Math.max(0, parseInt(item.stock, 10) || 0),
                    updatedAt: new Date().toISOString()
                };
            } else {
                list.push(item);
            }
        } else {
            // Add new
            const newItem = {
                ...item,
                id: `merch-${Date.now()}`,
                size: item.size || null,
                price: Number(item.price) || 0,
                stock: Math.max(0, parseInt(item.stock, 10) || 0),
                createdAt: new Date().toISOString().split("T")[0]
            };
            list.push(newItem);
        }
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        }
        return list;
    } catch (error) {
        console.error("Error saving merchandise item:", error);
        throw error;
    }
}

/**
 * Restocks or adjusts the quantity of a merchandise item.
 */
export function restockMerchandise(itemId, addedQuantity) {
    try {
        const list = getMerchandiseList();
        const item = list.find(m => m.id === itemId);
        if (!item) throw new Error("Item not found in catalog");

        const qty = parseInt(addedQuantity, 10) || 0;
        item.stock = Math.max(0, (item.stock || 0) + qty);
        item.updatedAt = new Date().toISOString();

        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        }
        return list;
    } catch (error) {
        console.error("Error restocking merchandise:", error);
        throw error;
    }
}

/**
 * Decrements stock when a purchase or sale is recorded.
 */
export function decrementMerchandiseStock(itemIdOrName, soldQuantity = 1) {
    try {
        const list = getMerchandiseList();
        const targetStr = String(itemIdOrName).toLowerCase();
        
        // 1. Match by exact ID or name
        let item = list.find(m => m.id === itemIdOrName || m.name.toLowerCase() === targetStr);
        
        // 2. Substring match
        if (!item) {
            item = list.find(m => targetStr.includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(targetStr));
        }

        // 3. Size match if shirt
        if (!item && (targetStr.includes("shirt") || targetStr.includes("t-shirt"))) {
            const sizeMatch = targetStr.match(/\b(xs|xl|2xl|s|m|l)\b/i);
            if (sizeMatch) {
                const s = sizeMatch[1].toUpperCase();
                item = list.find(m => (m.size || "").toUpperCase() === s);
            }
        }

        // 4. Fallback to first shirt if still generic
        if (!item && (targetStr.includes("shirt") || targetStr.includes("t-shirt"))) {
            item = list.find(m => (m.name || "").toLowerCase().includes("shirt"));
        }

        if (item) {
            const qty = Math.max(1, parseInt(soldQuantity, 10) || 1);
            item.stock = Math.max(0, (item.stock || 0) - qty);
            item.updatedAt = new Date().toISOString();
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            }
            return item;
        }
        return null;
    } catch (error) {
        console.error("Error decrementing merchandise stock:", error);
        return null;
    }
}

/**
 * Deletes an item from the merchandise catalog.
 */
export function deleteMerchandiseItem(itemId) {
    try {
        const list = getMerchandiseList().filter(m => m.id !== itemId);
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        }
        return list;
    } catch (error) {
        console.error("Error deleting merchandise item:", error);
        throw error;
    }
}
