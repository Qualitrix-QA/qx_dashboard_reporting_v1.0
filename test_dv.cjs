const XLSX = require('xlsx');
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([['Filter', 'All']]);
ws['!dataValidation'] = [{ sqref: 'B1', type: 'list', formula1: '"All,A,B,C"' }];
XLSX.utils.book_append_sheet(wb, ws, 'Test');
XLSX.writeFile(wb, 'test.xlsx');
console.log('Done');
