

const setCurrentRoute = (req, res,next)=>{
    
    res.locals.currentRoute = req.path
    next()
}

module.exports = setCurrentRoute