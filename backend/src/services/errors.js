class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status >= 500) console.error('API error:', error.code || error.name || 'Error');
    res.status(status).json({ eroare: error instanceof HttpError || status < 500 ? error.message : 'Eroare internă. Încearcă din nou.' });
}
module.exports = { HttpError, errorHandler };
