const Auths = require("../model/authorizations"); // Import your model

const attachAuths = async (req, res, next) => {
    if (!req.session.user) {
        return next(); // Skip if no user session
    }

    try {
        const auths = await Auths.findOne({ where: { userId: req.session.user } });
        res.locals.auths = auths; // Make auths available globally in views
    } catch (error) {
        console.error("Error fetching auths:", error);
        res.locals.auths = null;
    }

    next();
};

module.exports = attachAuths;
