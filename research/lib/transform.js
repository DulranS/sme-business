export function transformShopifyToEbayFormat(shopifyData) {
    return shopifyData.map(item => ({
      Title: item.Title || '',
      Description: item['Body (HTML)'] || '',
      Price: item['Variant Price'] || '',
      Quantity: item['Variant Inventory Qty'] || '0',
      SKU: item['Variant SKU'] || '',
      'Item Condition': 'New',
      'Shipping Type': 'Calculated',
      'Product Category': '',
      Images: item['Image Src'] || ''
    }))
  }