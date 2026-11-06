const admin = require("firebase-admin");

function getMessaging() {
    if (!admin.apps.length) {
        const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        if (!encoded) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set.");
        }
        const serviceAccount = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    return admin.messaging();
}

module.exports = { getMessaging };