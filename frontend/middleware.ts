import type { NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
    try {
        console.log('Middleware called for:', request.nextUrl.pathname);
        console.log('Auth0 config check:', {
            hasSecret: !!process.env.AUTH0_SECRET,
            hasBaseUrl: !!process.env.AUTH0_BASE_URL,
            baseUrl: process.env.AUTH0_BASE_URL,
            hasIssuerUrl: !!process.env.AUTH0_ISSUER_BASE_URL,
            issuerUrl: process.env.AUTH0_ISSUER_BASE_URL,
            hasClientId: !!process.env.AUTH0_CLIENT_ID,
        });

        return await auth0.middleware(request);
    } catch (error) {
        console.error('Middleware error:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        // Allow request to continue even if auth fails during development
        if (process.env.NODE_ENV === 'development') {
            return;
        }

        throw error;
    }
}

export const config = {
    matcher: [
        // Match all paths except:
        // - _next/static and _next/image
        // - favicon.ico
        // - robots.txt
        // - sitemap.xml and sitemap-*.xml
        // - api/auth (Auth0 callback/login/logout)
        // - the home page (/)
        // - about and optional subpaths (/about or /about/...)
        // - api/save-email (excluded to allow unauthenticated access)
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap\\.xml|sitemap-.*\\.xml|api/auth|api/save-email|about(?:/.*)?|$).*)",
    ],
};