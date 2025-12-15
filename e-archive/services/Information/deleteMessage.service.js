const { AdminAction } = require('../../model/adminAction');

async function deleteMessage(id) {
  if (!id) throw new Error('Message ID is required');
  const msg = await AdminAction.findByPk(id);
  if (!msg) throw new Error('Message not found');
  await msg.destroy();
  return { success: true };
}

module.exports = deleteMessage;
