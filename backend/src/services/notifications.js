// Emailul este trimis după salvare; eșecul său nu schimbă rezultatul operației.
function sendNotification(send, failureMessage) {
    return Promise.resolve().then(send).catch(() => console.error(failureMessage));
}
module.exports = { sendNotification };
