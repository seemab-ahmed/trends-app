// Test month generation logic
function getPreviousMonthYear() {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

console.log('Current month:', getCurrentMonthYear());
console.log('Previous month:', getPreviousMonthYear());
console.log('Test months:');
console.log('2025-06:', new Date(2025, 5, 1).toISOString()); // June 2025
console.log('2025-08:', new Date(2025, 7, 1).toISOString()); // August 2025
console.log('2025-09:', new Date(2025, 8, 1).toISOString()); // September 2025
