
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getMessaging: getFirebaseMessaging } = require("firebase-admin/messaging");

function getMessaging() {
    if (getApps().length === 0) {
        const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

        if (!encoded) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set.");
        }

        let serviceAccount;

        try {
            serviceAccount = JSON.parse(
                Buffer.from(encoded, "base64").toString("utf8")
            );
        } catch (error) {
            throw new Error(
                "FIREBASE_SERVICE_ACCOUNT_BASE64 contains invalid service account JSON.",
                { cause: error }
            );
        }

        initializeApp({
            credential: cert(serviceAccount)
        });
    }

    return getFirebaseMessaging();
}

module.exports = { getMessaging };
