const { HttpError } = require('./errors');
const invalid = message => { throw new HttpError(400, message); };
function integer(value, name = 'ID', min = 1, max = Number.MAX_SAFE_INTEGER) {
    if (!/^[0-9]+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) invalid(`${name} invalid.`);
    return Number(value);
}
function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01' || value > '9999-12-31') invalid('Data trebuie să fie o dată calendaristică YYYY-MM-DD.');
    const parsed = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid('Data calendaristică nu este validă.');
    return value;
}
function interval(checkin, checkout, { optional = false, future = false, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' }) } = {}) {
    if (optional && !checkin && !checkout) return null;
    date(checkin); date(checkout);
    if (checkout <= checkin) invalid('Check-out trebuie să fie după check-in.');
    if (future && checkin < today) invalid('Check-in nu poate fi în trecut.');
    const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000);
    return { checkin, checkout, nights };
}
function money(value, name = 'Preț') {
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) invalid(`${name} invalid.`);
    const cents = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(cents) || cents > 9999999999) invalid(`${name} invalid.`);
    return cents;
}
module.exports = { integer, date, interval, money, invalid };
