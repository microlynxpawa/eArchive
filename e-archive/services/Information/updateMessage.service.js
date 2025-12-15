const { AdminAction } = require('../../model/adminAction');

async function updateMessage({ id, message }) {
  if (!id || !message) throw new Error('Message ID and new message are required');
  const msg = await AdminAction.findByPk(id);
  if (!msg) throw new Error('Message not found');
  msg.message = message;
  await msg.save();
  return msg;
}

module.exports = updateMessage;
