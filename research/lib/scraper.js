import puppeteer from 'puppeteer';

const defaultImageUrl = "/default-image.avif"

const CURRENCY_CONVERSION_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

async function fetchExchangeRates() {
  try {
    const response = await fetch(CURRENCY_CONVERSION_API_URL);
    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return null;
  }
}

export async function scrapeAliExpress(searchTerm) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const randomPage = Math.floor(Math.random() * 5) + 1;
  await page.goto(`https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(searchTerm)}&page=${randomPage}`);

  const exchangeRates = await fetchExchangeRates();

  const products = await page.evaluate(async (defaultImageUrl, exchangeRates) => {
    function parsePrice(priceText) {
      const priceMatch = priceText.match(/[\d.,]+/);
      return priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : null;
    }

    async function convertToUSD(price, fromCurrency, exchangeRates) {
      if (exchangeRates && exchangeRates[fromCurrency]) {
        return (price / exchangeRates[fromCurrency]).toFixed(2);
      }
      return price;
    }

    const allProducts = Array.from(document.querySelectorAll('.search-item-card-wrapper-gallery'));
    
    for (let i = allProducts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allProducts[i], allProducts[j]] = [allProducts[j], allProducts[i]];
    }

    const randomProductCount = Math.floor(Math.random() * 11) + 10;
    const selectedProducts = allProducts.slice(0, randomProductCount);

    return Promise.all(selectedProducts.map(async el => {
      const priceText = el.querySelector('.multi--price-sale--U-S0jtj')?.innerText || 'No price available';
      const localCurrency = 'CNY';
      const price = parsePrice(priceText);
      const priceInUSD = price ? await convertToUSD(price, localCurrency, exchangeRates) : 'No price available';

      const productUrl = el.querySelector('a')?.href || 'No URL available';
      
      // Fetch product page to get description
      let description = 'No description available';
      try {
        const response = await fetch(productUrl);
        const productHtml = await response.text();
        const parser = new DOMParser();
        const productDoc = parser.parseFromString(productHtml, 'text/html');
        description = productDoc.querySelector('.product-description')?.innerText || 'No description available';
      } catch (error) {
        console.error('Error fetching product description:', error);
      }

      return {
        'Handle': '', // Shopify CSV format
        'Title': el.querySelector('.multi--titleText--nXeOvyr')?.innerText || 'No name available',
        'Body (HTML)': description,
        'Vendor': 'AliExpress',
        'Type': '',
        'Tags': '',
        'Published': 'TRUE',
        'Option1 Name': 'Title',
        'Option1 Value': 'Default Title',
        'Option2 Name': '',
        'Option2 Value': '',
        'Option3 Name': '',
        'Option3 Value': '',
        'Variant SKU': '',
        'Variant Grams': '',
        'Variant Inventory Tracker': '',
        'Variant Inventory Qty': '',
        'Variant Inventory Policy': 'deny',
        'Variant Fulfillment Service': 'manual',
        'Variant Price': priceInUSD,
        'Variant Compare At Price': '',
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        'Variant Barcode': '',
        'Image Src': el.querySelector('.images--item--3XZa6xf')?.src || defaultImageUrl,
        'Image Position': '1',
        'Image Alt Text': '',
        'Gift Card': 'FALSE',
        'SEO Title': '',
        'SEO Description': '',
        'Google Shopping / Google Product Category': '',
        'Google Shopping / Gender': '',
        'Google Shopping / Age Group': '',
        'Google Shopping / MPN': '',
        'Google Shopping / AdWords Grouping': '',
        'Google Shopping / AdWords Labels': '',
        'Google Shopping / Condition': '',
        'Google Shopping / Custom Product': '',
        'Google Shopping / Custom Label 0': '',
        'Google Shopping / Custom Label 1': '',
        'Google Shopping / Custom Label 2': '',
        'Google Shopping / Custom Label 3': '',
        'Google Shopping / Custom Label 4': '',
        'Variant Image': '',
        'Variant Weight Unit': 'kg',
        'Variant Tax Code': '',
        'Cost per item': '',
        'Status': 'active',
      };
    }));
  }, defaultImageUrl, exchangeRates);

  await browser.close();
  
  return products;
}