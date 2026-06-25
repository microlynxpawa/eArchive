const SystemSettings = require("../../model/systemSettings");
const { invalidateProvider } = require("../../storage/storageProvider");

const VALID_PROVIDERS = ["local", "s3"];

const REQUIRED_ENV = {
  s3: ["AWS_BUCKET", "AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
};

function validateProviderConfig(type) {
  const required = REQUIRED_ENV[type] || [];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for ${type}: ${missing.join(", ")}`
    );
  }
}

async function getActiveProvider() {
  const settings = await SystemSettings.findOne();
  return settings?.activeProvider ?? "local";
}

async function setActiveProvider(type, userId) {
  if (!VALID_PROVIDERS.includes(type)) {
    throw new Error(`Invalid provider: ${type}. Must be one of: ${VALID_PROVIDERS.join(", ")}`);
  }
  validateProviderConfig(type);
  const settings = await SystemSettings.findOne();
  if (settings) {
    await settings.update({ activeProvider: type, updatedBy: userId });
  } else {
    await SystemSettings.create({ activeProvider: type, updatedBy: userId });
  }
  invalidateProvider();
}

module.exports = { getActiveProvider, setActiveProvider, validateProviderConfig, VALID_PROVIDERS };
