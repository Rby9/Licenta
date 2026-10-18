const jwt = require('jsonwebtoken');
const ADMIN_ROLES = ['super_admin', 'admin_hotel', 'admin_marketing', 'admin_booking'];
function createAuth(db, secret) {
    const verificaToken = async (req, res, next) => {
        const authorization = req.headers.authorization;
        if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) return res.status(401).json({ eroare: 'Token lipsă.' });
        let claims;
        try { claims = jwt.verify(authorization.slice(7), secret, { algorithms: ['HS256'] }); }
        catch { return res.status(403).json({ eroare: 'Token invalid.' }); }
        if (!Number.isSafeInteger(Number(claims.id))) return res.status(403).json({ eroare: 'Token invalid.' });
        const [rows] = await db.promise().execute('SELECT id_utilizator,rol FROM Utilizatori WHERE id_utilizator=?', [claims.id]);
        if (!rows.length) return res.status(401).json({ eroare: 'Cont inexistent.' });
        req.user = { id: Number(rows[0].id_utilizator), rol: rows[0].rol };
        next();
    };
    const verificaRol = (...roles) => (req, res, next) => {
        if (!roles.includes(req.user.rol)) return res.status(403).json({ eroare: 'Acces neautorizat.' });
        next();
    };
    return { verificaToken, verificaRol, ADMIN_ROLES,
        oriceAdmin: verificaRol(...ADMIN_ROLES), adminHotel: verificaRol('super_admin', 'admin_hotel'),
        adminBooking: verificaRol('super_admin', 'admin_booking'),
        adminMarketing: verificaRol('super_admin', 'admin_marketing'), superAdmin: verificaRol('super_admin') };
}
module.exports = { createAuth, ADMIN_ROLES };
