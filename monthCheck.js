/*
 * Creator: Ayo Kunle
 * Support: TMK team
*/
// name -> monthCheck.js
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'monthCheck.json');

// Create file if it doesn't exist
if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(dataPath, JSON.stringify({ lastMonth: null, lastYear: null }, null, 2));
}

function checkMonthYear() {
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-11
  const currentYear = today.getFullYear();

  let data = JSON.parse(fs.readFileSync(dataPath));

  if (data.lastMonth !== currentMonth || data.lastYear !== currentYear) {
    // New month detector
    data.lastMonth = currentMonth;
    data.lastYear = currentYear;
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

    // Change logic (optional)
    console.log("📆 Happy new month!");
    return true;
  }

  return false;
}

module.exports = { checkMonthYear };