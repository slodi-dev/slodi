// lib/auth0.ts
import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Validation with detailed error messages
const requiredEnvVars = {
    AUTH0_SECRET: process.env.AUTH0_SECRET,
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL,
    AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
};

const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (missingVars.length > 0) {
    throw new Error(
        `Missing required Auth0 environment variables: ${missingVars.join(', ')}\n` +
        `Please check your .env.local file.`
    );
}

// Log config for debugging (remove in production)
if (process.env.NODE_ENV === 'development') {
    console.log('Auth0 Configuration:', {
        baseURL: process.env.AUTH0_BASE_URL,
        issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
        hasSecret: !!process.env.AUTH0_SECRET,
        hasClientId: !!process.env.AUTH0_CLIENT_ID,
        hasClientSecret: !!process.env.AUTH0_CLIENT_SECRET,
    });
}
// Initialize the Auth0 client
export const auth0 = new Auth0Client({
    // Options are loaded from environment variables by default
    // Ensure necessary environment variables are properly set
    // domain: process.env.AUTH0_DOMAIN,
    // clientId: process.env.AUTH0_CLIENT_ID,
    // clientSecret: process.env.AUTH0_CLIENT_SECRET,
    // appBaseUrl: process.env.APP_BASE_URL,
    // secret: process.env.AUTH0_SECRET,

    authorizationParameters: {
        // In v4, the AUTH0_SCOPE and AUTH0_AUDIENCE environment variables for API authorized applications are no longer automatically picked up by the SDK.
        // Instead, we need to provide the values explicitly.
        scope: process.env.AUTH0_SCOPE || 'openid profile email',
        audience: process.env.AUTH0_AUDIENCE || undefined,
    },
});
