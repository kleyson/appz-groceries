// Barcode lookup service using Open Facts APIs
// Covers: food, beauty, pet food, and general products

export interface ProductInfo {
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  quantity: string | null;
  source: "food" | "beauty" | "petfood" | "products";
}

interface OpenFactsProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  quantity?: string;
}

interface OpenFactsResponse {
  status: number;
  status_verbose?: string;
  product?: OpenFactsProduct;
}

// API endpoints for different Open Facts databases
const OPEN_FACTS_APIS = [
  {
    url: "https://world.openfoodfacts.org/api/v2/product",
    source: "food" as const,
  },
  {
    url: "https://world.openbeautyfacts.org/api/v2/product",
    source: "beauty" as const,
  },
  {
    url: "https://world.openpetfoodfacts.org/api/v2/product",
    source: "petfood" as const,
  },
  {
    url: "https://world.openproductsfacts.org/api/v2/product",
    source: "products" as const,
  },
];

// Map Open Facts categories to our app categories
function mapToAppCategory(
  categories: string | undefined,
  categoryTags: string[] | undefined,
): string | null {
  if (!categories && !categoryTags) return null;

  const categoryString = (categories || "").toLowerCase();
  const tags = (categoryTags || []).map((t) => t.toLowerCase());

  // Food categories
  if (
    tags.some((t) => t.includes("fruit") || t.includes("vegetable")) ||
    categoryString.includes("produce")
  ) {
    return "Produce";
  }
  if (
    tags.some(
      (t) =>
        t.includes("dairy") ||
        t.includes("milk") ||
        t.includes("cheese") ||
        t.includes("yogurt"),
    )
  ) {
    return "Dairy";
  }
  if (
    tags.some(
      (t) =>
        t.includes("meat") ||
        t.includes("poultry") ||
        t.includes("beef") ||
        t.includes("chicken"),
    )
  ) {
    return "Meat";
  }
  if (
    tags.some(
      (t) =>
        t.includes("bread") || t.includes("bakery") || t.includes("pastry"),
    )
  ) {
    return "Bakery";
  }
  if (tags.some((t) => t.includes("frozen"))) {
    return "Frozen";
  }
  if (
    tags.some(
      (t) =>
        t.includes("beverage") ||
        t.includes("drink") ||
        t.includes("juice") ||
        t.includes("water") ||
        t.includes("soda"),
    )
  ) {
    return "Beverages";
  }
  if (
    tags.some(
      (t) =>
        t.includes("snack") ||
        t.includes("chip") ||
        t.includes("candy") ||
        t.includes("chocolate"),
    )
  ) {
    return "Snacks";
  }
  if (
    tags.some(
      (t) =>
        t.includes("cereal") ||
        t.includes("pasta") ||
        t.includes("rice") ||
        t.includes("sauce") ||
        t.includes("canned"),
    )
  ) {
    return "Pantry";
  }
  if (
    tags.some(
      (t) =>
        t.includes("cleaning") || t.includes("detergent") || t.includes("soap"),
    )
  ) {
    return "Household";
  }

  return null;
}

function parseProduct(
  product: OpenFactsProduct,
  source: ProductInfo["source"],
): ProductInfo {
  const name =
    product.product_name || product.product_name_en || "Unknown Product";
  const brand = product.brands || null;
  const category = mapToAppCategory(
    product.categories,
    product.categories_tags,
  );
  const imageUrl =
    product.image_front_small_url ||
    product.image_front_url ||
    product.image_url ||
    null;
  const quantity = product.quantity || null;

  return {
    name: brand ? `${brand} ${name}` : name,
    brand,
    category,
    imageUrl,
    quantity,
    source,
  };
}

/**
 * Look up a product by barcode across all Open Facts databases
 * @param barcode - The barcode to look up (EAN-13, UPC-A, etc.)
 * @returns Product info if found, null otherwise
 */
export async function lookupBarcode(
  barcode: string,
): Promise<ProductInfo | null> {
  // Clean the barcode - remove any non-numeric characters
  const cleanBarcode = barcode.replace(/\D/g, "");

  if (!cleanBarcode || cleanBarcode.length < 8) {
    console.warn("Invalid barcode:", barcode);
    return null;
  }

  // Try each API in order until we find a match
  for (const api of OPEN_FACTS_APIS) {
    try {
      const response = await fetch(`${api.url}/${cleanBarcode}.json`, {
        headers: {
          "User-Agent": "GroceriesApp/1.0 (contact@example.com)",
        },
      });

      if (!response.ok) {
        continue;
      }

      const data: OpenFactsResponse = await response.json();

      if (data.status === 1 && data.product) {
        return parseProduct(data.product, api.source);
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${api.source}:`, error);
      continue;
    }
  }

  return null;
}

/**
 * Look up a product from all APIs in parallel for faster results
 * @param barcode - The barcode to look up
 * @returns Product info if found, null otherwise
 */
export async function lookupBarcodeParallel(
  barcode: string,
): Promise<ProductInfo | null> {
  const cleanBarcode = barcode.replace(/\D/g, "");

  if (!cleanBarcode || cleanBarcode.length < 8) {
    console.warn("Invalid barcode:", barcode);
    return null;
  }

  // Query all APIs in parallel
  const promises = OPEN_FACTS_APIS.map(async (api) => {
    try {
      const response = await fetch(`${api.url}/${cleanBarcode}.json`, {
        headers: {
          "User-Agent": "GroceriesApp/1.0",
        },
      });

      if (!response.ok) {
        return null;
      }

      const data: OpenFactsResponse = await response.json();

      if (data.status === 1 && data.product) {
        return parseProduct(data.product, api.source);
      }
    } catch {
      return null;
    }
    return null;
  });

  const results = await Promise.all(promises);

  // Return the first successful result (prefer food > beauty > petfood > products)
  return results.find((r) => r !== null) || null;
}
