import { Auth0Client } from "@auth0/nextjs-auth0/server";

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

export const auth0 = new Auth0Client({
    authorizationParameters: {
        scope: process.env.AUTH0_SCOPE ?? 'openid profile email',
        audience: process.env.AUTH0_AUDIENCE,
    },
});