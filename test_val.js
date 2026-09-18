const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ['Product Filter:', 'All'],
  ['Sprint Filter:', 'All'],
  [],
  ['Data', 'Value']
]);

// Try adding data validation
ws['!dataValidation'] = [
  {
    sqref: 'B1',
    type: 'list',
    values: ['All', 'Product A', 'Product B']
  }
];

XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, 'test_val.xlsx');
console.log('Done');
