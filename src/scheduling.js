// ⏰ scheduleRandomMessage: a ticking time bomb of random messages
function scheduleRandomMessage() {
  const interval = chance.integer({ min: 60000 * 20, max: 60000 * 60 });
  setTimeout(() => {
    sendRandomMessageInRandomChannel();
    scheduleRandomMessage();
  }, interval);
}

// 📅 isWithinSendingHours: is it time to send a random message?
function isWithinSendingHours() {
  const currentTimeEST = getCurrentTimeEST();
  const startHour = 11; // 11 AM
  const endHour = 15; // 3 PM
  return (
    currentTimeEST.getHours() >= startHour &&
    currentTimeEST.getHours() < endHour
  );
}

module.exports = {
  scheduleRandomMessage,
  isWithinSendingHours,
};
