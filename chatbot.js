const fs = require("fs");
const chatbotOffPath = "./mode.json";

function isChatbotDisabled(chatId) {
  if (!fs.existsSync(chatbotOffPath)) return false;
  const list = JSON.parse(fs.readFileSync(chatbotOffPath));
  return list.includes(chatId);
}

function toggleChatbot(chatId) {
  let list = [];
  if (fs.existsSync(chatbotOffPath)) list = JSON.parse(fs.readFileSync(chatbotOffPath));

  const index = list.indexOf(chatId);
  const disabled = index !== -1;

  if (disabled) {
    list.splice(index, 1); // enable chatbot
  } else {
    list.push(chatId); // disable chatbot
  }

  fs.writeFileSync(chatbotOffPath, JSON.stringify(list, null, 2));
  return !disabled; // returns true if now enabled
}

module.exports = { isChatbotDisabled, toggleChatbot };