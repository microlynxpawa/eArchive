const { AdminAction } = require('../../model/adminAction');

async function createMessage({ adminId, message }) {
  if (!adminId || !message) throw new Error('Admin ID and message are required');
  const newMsg = await AdminAction.create({ adminId, message });
  return newMsg;
}

module.exports = createMessage;
