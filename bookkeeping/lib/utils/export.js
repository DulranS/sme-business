import Papa from 'papaparse';

// Export records to CSV
export const exportToCSV = (records, filename = 'bookkeeping-records.csv') => {
  if (!records || records.length === 0) {
    alert('No records to export');
    return;
  }

  // Format records for CSV
  const csvData = records.map(record => ({
    Date: record.date,
    Description: record.description,
    Category: record.category,
    Amount: record.amount,
    Quantity: record.quantity || 1,
    'Cost Per Unit': record.cost_per_unit || 0,
    Customer: record.customer || '',
    Project: record.project || '',
    Tags: record.tags || '',
    Notes: record.notes || '',
    'Attribution Source': record.attribution_source || 'direct',
    'Conversion Stage': record.conversion_stage || 'closed_won',
    'Campaign Details': record.campaign_details || '',
  }));

  // Generate CSV
  const csv = Papa.unparse(csvData);
  
  // Create download link
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export attribution report to CSV
export const exportAttributionReport = (attributionData, filename = 'attribution-report.csv') => {
  if (!attributionData || attributionData.length === 0) {
    alert('No attribution data to export');
    return;
  }

  const csvData = attributionData.map(record => ({
    Date: record.date,
    'Attribution Source': record.attribution_source || 'direct',
    'Conversion Stage': record.conversion_stage || 'closed_won',
    Category: record.category,
    Amount: record.amount,
    Quantity: record.quantity || 1,
    'Total Revenue': (parseFloat(record.amount) || 0) * (parseFloat(record.quantity) || 1),
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export financial summary to CSV
export const exportFinancialSummary = (totals, filename = 'financial-summary.csv') => {
  const summaryData = [
    { Metric: 'Total Inflow', Value: totals.inflow },
    { Metric: 'Total Outflow', Value: totals.outflow },
    { Metric: 'Reinvestment', Value: totals.reinvestment },
    { Metric: 'Overhead', Value: totals.overhead },
    { Metric: 'Loan Payment', Value: totals.loanPayment },
    { Metric: 'Loan Received', Value: totals.loanReceived },
    { Metric: 'Logistics', Value: totals.logistics },
    { Metric: 'Refund', Value: totals.refund },
    { Metric: 'On Hold Cash', Value: totals.onHoldCash },
    { Metric: 'Net Cash Flow', Value: totals.inflow - totals.outflow - totals.overhead - totals.logistics - totals.loanPayment + totals.loanReceived + totals.refund },
  ];

  const csv = Papa.unparse(summaryData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export to JSON
export const exportToJSON = (data, filename = 'export.json') => {
  if (!data) {
    alert('No data to export');
    return;
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
