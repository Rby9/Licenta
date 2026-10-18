function reservationView(row) {
    const date = value => value instanceof Date ? value.toLocaleDateString('en-CA') : String(value || '').slice(0, 10);
    const checkin = date(row.data_checkin), checkout = date(row.data_checkout);
    return { ...row, pret_total: Number(row.pret_total),
        comision: Number(row.comision ?? row.comision_platforma ?? 0), suma_hotel: Number(row.suma_hotel || 0),
        suma_avans: row.suma_avans == null ? null : Number(row.suma_avans),
        data_checkin: checkin, data_checkout: checkout,
        nopti: row.nopti ?? Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000) };
}
module.exports = { reservationView };
