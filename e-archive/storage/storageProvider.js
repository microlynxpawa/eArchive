const localProvider = require("./providers/localProvider");

let _provider = null;

async function getProvider() {
  if (_provider) return _provider;
  try {
    const SystemSettings = require("../model/systemSettings");
    const settings = await SystemSettings.findOne();
    const type = settings?.activeProvider ?? "local";
    _provider = buildProvider(type);
  } catch {
    // DB not ready (e.g. standalone scripts); fall back to local
    _provider = localProvider;
  }
  return _provider;
}

function buildProvider(type) {
  if (type === "s3") {
    const s3Provider = require("./providers/s3Provider");
    return s3Provider;
  }
  return localProvider;
}

function invalidateProvider() {
  _provider = null;
}

module.exports = { getProvider, invalidateProvider };
