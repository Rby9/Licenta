// checkout exclus; statusul necunoscut este tratat conservator ca ocupat.
function freeRoomSQL(alias = 'c') {
    return `NOT EXISTS (SELECT 1 FROM Rezervari r
        WHERE r.id_camera = ${alias}.id_camera
        AND (r.status_rezervare IS NULL OR r.status_rezervare <> 'anulata')
        AND r.data_checkin < ? AND r.data_checkout > ?)`;
}
module.exports = { freeRoomSQL };
