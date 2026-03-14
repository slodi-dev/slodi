import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    // offline_access is always appended to request a refresh token so the SDK
    // can silently renew access tokens without redirecting the user to logout.
    scope: `${process.env.AUTH0_SCOPE ?? "openid profile email"} offline_access`,
    audience: process.env.AUTH0_AUDIENCE,
  },
});
