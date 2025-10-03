import { exportToCsv } from '../../lib/csvExporter';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const products = req.body;
      const csv = exportToCsv(products);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=winning_products.csv');
      res.status(200).send(csv);
    } catch (error) {
      console.error('Export failed:', error);
      res.status(500).json({ error: 'Failed to export products' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}