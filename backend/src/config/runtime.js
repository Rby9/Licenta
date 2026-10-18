require('./env');
function runtime(env = process.env) {
    const siteUrl = env.SITE_URL || 'http://localhost:5173';
    const parsed = new URL(siteUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('SITE_URL trebuie să folosească HTTP sau HTTPS.');
    return {
        port: Number(env.PORT || 5001), host: env.HOST || '127.0.0.1',
        siteUrl: siteUrl.replace(/\/$/, ''), jwtSecret: env.JWT_SECRET,
        stripeSecret: env.STRIPE_SECRET_KEY, stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
        emailUser: env.EMAIL_USER, emailPass: env.EMAIL_PASS,
        emailFrom: env.EMAIL_FROM || env.EMAIL_USER || 'noreply@example.invalid',
    };
}
module.exports = { runtime };
