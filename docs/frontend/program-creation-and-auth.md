# Program Creation & User Authentication Implementation Plan

## Overview

This document outlines the implementation plan for:

1. Creating programs in the database through the frontend
2. User authentication and creation flow with Auth0

---

## Part 1: Program Creation Implementation

### Current State Analysis

**✅ What's Already Working:**

1. **NewProgramForm component** - Has UI and form handling
2. **`createProgram()` service** - Already makes POST request to `/workspaces/{workspaceId}/programs`
3. **Form submits data** - Name, description, public flag, image, tags
4. **Backend endpoint exists** - We confirmed `/workspaces/{workspace_id}/programs` POST endpoint
5. **Workspace ID available** - Page has `workspaceId = "36606c77-5e0d-4fc9-891f-4e0126c6e9a6"`

### What's Missing / Needs Implementation

#### 1. **Author ID Requirement**

- **Issue**: Backend requires `author_id` in the request body
- **Backend schema** requires: `author_id: UUID` (from ContentCreate base class)
- **Current form**: Doesn't collect or send author_id
- **Solution needed**: Pass authenticated user ID from session

#### 2. **Workspace ID in CreateProgram**

- **Issue**: `createProgram()` has `workspaceId` as optional with fallback to 'default'
- **Current**: Form doesn't pass workspaceId to createProgram
- **Solution needed**: Pass workspaceId from page context to form

#### 3. **Tags Association**

- **Current**: Tags are sent as string array in the request
- **Backend reality**: Tags need to be associated separately via content tags endpoint
- **Question**: Does the backend program creation handle tag strings or need UUIDs?

#### 4. **Refetch After Creation**

- **Current**: Form calls `onCreated(program)` callback
- **Needed**: Trigger refetch of programs list to show newly created program
- **Solution**: Call `refetch()` from usePrograms hook

### Implementation Steps (Program Creation)

#### **Step 1: Pass workspaceId to Form**

```tsx
<NewProgramForm workspaceId={workspaceId} onCreated={handleProgramCreated} />
```

#### **Step 2: Add author_id to Form**

Get from user context/session (see Part 2 below)

#### **Step 3: Update Form to Accept Props**

```tsx
type Props = {
  workspaceId: string;
  authorId?: string; // Optional, fallback to system user
  onCreated?: (program: Program) => void;
};
```

#### **Step 4: Update createProgram Call**

```tsx
const program = await createProgram({
  name: name.trim(),
  description: description.trim(),
  public: isPublic,
  image: image.trim(),
  imageFile: imageFile || undefined,
  tags: selectedTags.length > 0 ? selectedTags : undefined,
  workspaceId: props.workspaceId,
  authorId: props.authorId || SYSTEM_USER_ID,
});
```

#### **Step 5: Update ProgramCreateInput Type**

```tsx
export type ProgramCreateInput = {
  name: string;
  description?: string;
  public?: boolean;
  image?: string;
  imageFile?: File;
  tags?: string[];
  workspaceId: string; // Make required
  authorId: string; // Add author ID
};
```

#### **Step 6: Update Service to Send author_id**

```tsx
formData.append("author_id", input.authorId);
```

#### **Step 7: Trigger Refetch on Success**

```tsx
const handleProgramCreated = () => {
  setShowNewProgram(false);
  refetch(); // Refresh program list
};
```

---

## Part 2: User Authentication & Creation Flow

### Authentication Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER AUTHENTICATION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

1. User visits site (not authenticated)
   │
   ├─→ Redirect to Auth0 login
   │
2. Auth0 authentication
   │
   ├─→ User provides credentials
   ├─→ Auth0 validates user
   ├─→ Returns ID token + access token
   │
3. Frontend receives Auth0 tokens
   │
   ├─→ Extract user info from ID token:
   │   - auth0_id (sub)
   │   - email
   │   - name
   │
4. Check if user exists in backend
   │
   ├─→ GET /users?q={auth0_id} or GET /users/auth0/{auth0_id}
   │
   ├─→ User exists?
   │   │
   │   ├─→ YES: Fetch user data from backend
   │   │
   │   └─→ NO: Create user in backend
   │       │
   │       ├─→ POST /users
   │       │   {
   │       │     "auth0_id": "auth0|123456",
   │       │     "email": "user@example.is",
   │       │     "name": "User Name"
   │       │   }
   │       │
   │       └─→ Receive created user with UUID
   │
5. Store user session in frontend
   │
   ├─→ Store in context/state:
   │   - userId (UUID from backend)
   │   - auth0Id
   │   - email
   │   - name
   │   - accessToken (for backend API calls)
   │
6. User is authenticated & ready
   │
   └─→ Can now create programs, access workspaces, etc.
```

### Backend API Requirements

#### Get Current Authenticated User (with auto-creation)

**Endpoint:** `GET /users/me`

**Headers:**

```
Authorization: Bearer {auth0_access_token}
```

**Backend Behavior:**

1. Verify Auth0 token
2. Extract `auth0_id` from verified token
3. Look up user by `auth0_id`
4. If user doesn't exist, create automatically
5. Return user data

**Response:**

```json
{
  "id": "uuid-here",
  "auth0_id": "auth0|123456789",
  "email": "user@example.is",
  "name": "User Name",
  "pronouns": null,
  "preferences": null
}
```

**Security:** User creation only happens when a valid Auth0 token is provided. The `auth0_id` comes from the verified token, not from the client.

### Frontend Implementation Architecture

#### 1. **Auth Context Provider** (`contexts/AuthContext.tsx`)

```tsx
type User = {
  id: string; // Backend UUID
  auth0Id: string; // Auth0 ID
  email: string;
  name: string;
  // NO accessToken - stored in httpOnly cookie by backend
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Auth0
  // Handle callback
  // Create or fetch user from backend
  // Store in context

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

#### 2. **User Service** (`services/users.service.ts`)

```tsx
/**
 * Get current authenticated user from backend
 * Backend will auto-create user on first login
 */
export async function getCurrentUser(accessToken: string): Promise<User> {
  const url = buildApiUrl("/users/me");
  return fetchAndCheck<User>(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });
}

/**
 * Update current user profile
 */
export async function updateCurrentUser(
  accessToken: string,
  updates: UserUpdateInput
): Promise<User> {
  const url = buildApiUrl("/users/me");
  return fetchAndCheck<User>(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
    credentials: "include",
  });
}

export type User = {
  id: string;
  auth0_id: string;
  email: string;
  name: string;
  pronouns?: string | null;
  preferences?: Record<string, any> | null;
};

export type UserUpdateInput = {
  name?: string;
  pronouns?: string | null;
  preferences?: Record<string, any> | null;
};
```

#### 3. **Authentication Hook** (`hooks/useAuth.ts`)

```tsx
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

### Auth0 Configuration

#### Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
NEXT_PUBLIC_AUTH0_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_AUTH0_AUDIENCE=https://your-api-identifier
```

#### Auth0 SDK Setup

```tsx
import { Auth0Provider } from "@auth0/auth0-react";

<Auth0Provider
  domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN}
  clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID}
  redirectUri={process.env.NEXT_PUBLIC_AUTH0_REDIRECT_URI}
  audience={process.env.NEXT_PUBLIC_AUTH0_AUDIENCE}>
  <AuthProvider>
    <App />
  </AuthProvider>
</Auth0Provider>;
```

### Complete Authentication Flow Implementation

#### ⚠️ SECURITY: Backend-Controlled User Creation

**❌ WRONG APPROACH - Client-Side User Creation:**

```tsx
// ❌ BAD: Frontend decides to create users
if (!backendUser) {
  backendUser = await createUser({
    auth0_id: auth0User.sub,
    email: auth0User.email,
    name: auth0User.name,
  });
}
```

**Problem:** Anyone can call your `POST /users` endpoint with any `auth0_id`. An attacker could:

- Create fake users with arbitrary auth0_ids
- Impersonate other users
- Pollute your database

**✅ CORRECT APPROACH - Backend-Controlled:**

The backend should handle user creation automatically when a valid Auth0 token is presented:

1. Frontend sends Auth0 access token with every API request
2. Backend middleware verifies the token with Auth0
3. Backend extracts `auth0_id` from verified token (cannot be forged)
4. Backend checks if user exists, creates if needed
5. Backend returns user data

#### Backend Implementation Required

**Middleware to verify Auth0 token and auto-create users:**

```python
# backend/app/core/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session)
) -> User:
    token = credentials.credentials

    try:
        # Verify token with Auth0
        payload = verify_auth0_token(token)
        auth0_id = payload["sub"]
        email = payload["email"]
        name = payload.get("name", email)

        # Get or create user
        user_service = UserService(session)
        user = await user_service.get_by_auth0_id(auth0_id)

        if not user:
            # Auto-create user (SAFE because token is verified)
            user = await user_service.create({
                "auth0_id": auth0_id,
                "email": email,
                "name": name
            })

        return user

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
```

**Protected endpoints use this middleware:**

```python
@router.post("/workspaces/{workspace_id}/programs")
async def create_program(
    workspace_id: UUID,
    body: ProgramCreate,
    current_user: User = Depends(get_current_user)  # ← Auto user creation
):
    # current_user is guaranteed to exist and be authenticated
    # Use current_user.id as author_id
    pass
```

#### Frontend Implementation (Complete & Secure)

**Complete AuthContext with Token Management:**

```tsx
// contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { getCurrentUser, type User } from "@/services/users.service";

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  getToken: () => Promise<string | null>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    user: auth0User,
    isAuthenticated: auth0IsAuthenticated,
    isLoading: auth0IsLoading,
    getAccessTokenSilently,
    loginWithRedirect,
    logout: auth0Logout,
  } = useAuth0();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get fresh token for API calls (with automatic refresh)
  const getToken = useCallback(async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: {
          audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
        },
      });
    } catch (error) {
      console.error("Error getting token:", error);
      // Token refresh failed, logout user
      await auth0Logout();
      return null;
    }
  }, [getAccessTokenSilently, auth0Logout]);

  // Fetch user from backend when Auth0 authentication completes
  const fetchBackendUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }

      // Backend will auto-create user if first login
      const backendUser = await getCurrentUser(token);
      setUser(backendUser);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Fetch user when Auth0 auth state changes
  useEffect(() => {
    if (auth0IsAuthenticated && auth0User) {
      fetchBackendUser();
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [auth0IsAuthenticated, auth0User, fetchBackendUser]);

  async function login() {
    await loginWithRedirect();
  }

  async function logout() {
    setUser(null);
    await auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading: isLoading || auth0IsLoading,
        login,
        logout,
        getToken, // Expose token getter for API calls
        refetch: fetchBackendUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

**Step-by-Step Process**

1. **User Clicks Login**

   - Redirects to Auth0 login page
   - User authenticates with Auth0
   - Auth0 redirects back with authorization code

2. **Auth0 SDK Handles Callback**

   - Exchanges code for tokens automatically
   - Stores tokens securely (managed by SDK)
   - Triggers `auth0IsAuthenticated = true`

3. **Fetch Backend User**

   - Get fresh token with `getAccessTokenSilently()`
   - Call `GET /users/me` with token
   - Backend verifies token and auto-creates user if needed
   - Store user info in context (no tokens!)

4. **Create API Service Helper**

   ```tsx
   // lib/api.ts (updated)
   export async function fetchWithAuth<T>(
     url: string,
     options: RequestInit = {},
     getToken: () => Promise<string | null>
   ): Promise<T> {
     const token = await getToken();

     if (!token) {
       throw new Error("No authentication token available");
     }

     const response = await fetch(url, {
       ...options,
       headers: {
         ...options.headers,
         Authorization: `Bearer ${token}`,
       },
       credentials: "include",
     });

     if (!response.ok) {
       if (response.status === 401) {
         // Token expired or invalid - redirect to login
         window.location.href = "/login";
         throw new Error("Authentication required");
       }
       throw new Error(`API error: ${response.statusText}`);
     }

     return response.json();
   }
   ```

5. **Update User Service**

   ```tsx
   // services/users.service.ts
   import { buildApiUrl } from "@/lib/api-utils";
   import { fetchWithAuth } from "@/lib/api";

   export type User = {
     id: string;
     auth0_id: string;
     email: string;
     name: string;
     pronouns?: string | null;
     preferences?: Record<string, any> | null;
   };

   /**
    * Get current authenticated user from backend.
    * Backend will auto-create user on first login.
    */
   export async function getCurrentUser(token: string): Promise<User> {
     const url = buildApiUrl("/users/me");

     // Special case: this is called during auth, so we pass token directly
     const response = await fetch(url, {
       method: "GET",
       headers: {
         Authorization: `Bearer ${token}`,
       },
       credentials: "include",
     });

     if (!response.ok) {
       throw new Error(`Failed to get user: ${response.statusText}`);
     }

     return response.json();
   }
   ```

6. **Update Program Service**

   ```tsx
   // services/programs.service.ts (updated)
   export async function createProgram(
     input: ProgramCreateInput,
     getToken: () => Promise<string | null>
   ): Promise<Program> {
     const url = buildApiUrl(`/workspaces/${input.workspaceId}/programs`);

     const formData = new FormData();
     formData.append("name", input.name);
     formData.append("description", input.description || "");
     formData.append("public", String(input.public ?? true));
     // Don't send author_id - backend uses authenticated user

     if (input.imageFile) {
       formData.append("image", input.imageFile);
     } else if (input.image) {
       formData.append("image", input.image);
     }

     if (input.tags?.length) {
       input.tags.forEach((tag) => formData.append("tags", tag));
     }

     return fetchWithAuth<Program>(
       url,
       {
         method: "POST",
         body: formData,
       },
       getToken
     );
   }

   export type ProgramCreateInput = {
     name: string;
     description?: string;
     public?: boolean;
     image?: string;
     imageFile?: File;
     tags?: string[];
     workspaceId: string;
     // authorId removed - backend uses authenticated user
   };
   ```

7. **Update NewProgramForm Component**

   ```tsx
   // components/NewProgram/NewProgramForm.tsx
   import { useAuth } from "@/contexts/AuthContext";

   export default function NewProgramForm(props: Props) {
     const { getToken } = useAuth();
     const [isSubmitting, setIsSubmitting] = useState(false);
     // ... other state

     async function handleSubmit(e: FormEvent) {
       e.preventDefault();
       setIsSubmitting(true);

       try {
         const program = await createProgram(
           {
             name: name.trim(),
             description: description.trim(),
             public: isPublic,
             image: image.trim(),
             imageFile: imageFile || undefined,
             tags: selectedTags.length > 0 ? selectedTags : undefined,
             workspaceId: props.workspaceId,
             // No authorId needed - backend uses authenticated user
           },
           getToken
         ); // Pass token getter function

         props.onCreated?.(program);
       } catch (error) {
         console.error("Failed to create program:", error);
         // TODO: Show error to user
       } finally {
         setIsSubmitting(false);
       }
     }

     return (
       <form onSubmit={handleSubmit}>
         {/* Form fields */}
         <button type="submit" disabled={isSubmitting}>
           {isSubmitting ? "Býr til..." : "Stofna dagskrá"}
         </button>
       </form>
     );
   }
   ```

8. **Backend Endpoints**

   ```python
   # Backend: GET /users/me
   @router.get("/users/me", response_model=UserOut)
   async def get_current_user_info(
       current_user: User = Depends(get_current_user)
   ):
       """Returns current authenticated user (auto-creates if first login)"""
       return current_user
   ```

   ```python
   # Backend: POST /workspaces/{workspace_id}/programs
   @router.post("/workspaces/{workspace_id}/programs")
   async def create_program(
       workspace_id: UUID,
       body: ProgramCreate,
       current_user: User = Depends(get_current_user)
   ):
       # Override author_id with authenticated user (never trust client)
       body.author_id = current_user.id

       svc = ProgramService(session)
       return await svc.create_under_workspace(workspace_id, body)
   ```

### Security Considerations

1. **Token Management Strategy**

   **🎯 RECOMMENDED APPROACH: Auth0 SDK Token Management**

   For Slóði, we use the simpler and more secure approach:

   - Auth0 SDK handles token storage and refresh automatically
   - Frontend never stores tokens (Auth0 SDK manages them internally)
   - Fresh tokens obtained via `getAccessTokenSilently()` for each API request
   - Tokens sent in `Authorization: Bearer {token}` header
   - No need for backend session cookies or custom token refresh logic

   **❌ WRONG: Storing tokens in localStorage/state**

   ```tsx
   // ❌ BAD: Storing tokens is vulnerable to XSS
   setUser({
     id: backendUser.id,
     accessToken, // VULNERABLE TO XSS
   });
   localStorage.setItem("token", accessToken); // EVEN WORSE
   ```

   **✅ CORRECT: Let Auth0 SDK manage tokens**

   ```tsx
   // ✅ GOOD: Auth0 SDK handles token storage securely
   const { getAccessTokenSilently } = useAuth0();

   // Get fresh token when needed
   const token = await getAccessTokenSilently();

   // Frontend only stores public user info
   setUser({
     id: backendUser.id,
     auth0Id: backendUser.auth0_id,
     email: backendUser.email,
     name: backendUser.name,
     // NO accessToken stored!
   });
   ```

   **Why this approach?**

   - Auth0 SDK handles token refresh automatically
   - No XSS vulnerability (tokens not in accessible storage)
   - Simpler implementation (no session management needed)
   - Works seamlessly with Auth0's security features

2. **API Authentication & Token Validation**

   **Every API request must validate the Auth0 token.**

   **Complete Backend Token Validation Implementation:**

   ```python
   # backend/app/core/config.py
   from pydantic_settings import BaseSettings

   class Settings(BaseSettings):
       AUTH0_DOMAIN: str
       AUTH0_AUDIENCE: str
       AUTH0_ALGORITHMS: list[str] = ["RS256"]

       class Config:
           env_file = ".env"

   settings = Settings()
   ```

   ```python
   # backend/app/core/auth.py
   from fastapi import Depends, HTTPException, status
   from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
   from jose import jwt, jwk
   from jose.exceptions import JWTError
   import httpx
   from functools import lru_cache
   from app.core.config import settings

   security = HTTPBearer()

   @lru_cache()
   def get_auth0_jwks():
       """Fetch and cache Auth0 public keys for JWT verification"""
       jwks_url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
       response = httpx.get(jwks_url)
       response.raise_for_status()
       return response.json()

   def verify_auth0_token(token: str) -> dict:
       """
       Verify Auth0 JWT token:
       1. Get unverified header to find correct key
       2. Fetch Auth0 JWKS and find matching key
       3. Validate JWT signature with public key
       4. Check expiration, audience, issuer
       5. Extract claims (auth0_id, email, etc.)
       """
       try:
           # Get unverified header to find which key to use
           unverified_header = jwt.get_unverified_header(token)

           # Get the key from JWKS
           jwks = get_auth0_jwks()
           rsa_key = {}
           for key in jwks["keys"]:
               if key["kid"] == unverified_header["kid"]:
                   rsa_key = {
                       "kty": key["kty"],
                       "kid": key["kid"],
                       "use": key["use"],
                       "n": key["n"],
                       "e": key["e"]
                   }
                   break

           if not rsa_key:
               raise HTTPException(
                   status_code=status.HTTP_401_UNAUTHORIZED,
                   detail="Unable to find appropriate key"
               )

           # Verify the token
           payload = jwt.decode(
               token,
               rsa_key,
               algorithms=settings.AUTH0_ALGORITHMS,
               audience=settings.AUTH0_AUDIENCE,
               issuer=f"https://{settings.AUTH0_DOMAIN}/"
           )

           return payload

       except jwt.ExpiredSignatureError:
           raise HTTPException(
               status_code=status.HTTP_401_UNAUTHORIZED,
               detail="Token has expired"
           )
       except jwt.JWTClaimsError:
           raise HTTPException(
               status_code=status.HTTP_401_UNAUTHORIZED,
               detail="Invalid token claims"
           )
       except JWTError as e:
           raise HTTPException(
               status_code=status.HTTP_401_UNAUTHORIZED,
               detail=f"Invalid token: {str(e)}"
           )
       except Exception as e:
           raise HTTPException(
               status_code=status.HTTP_401_UNAUTHORIZED,
               detail=f"Token verification failed: {str(e)}"
           )

   async def get_current_user(
       credentials: HTTPAuthorizationCredentials = Depends(security),
       session: AsyncSession = Depends(get_session)
   ) -> User:
       """
       Dependency that:
       1. Extracts Bearer token from Authorization header
       2. Verifies token with Auth0
       3. Gets or creates user in database
       4. Returns authenticated User object
       """
       token = credentials.credentials

       # Verify token and get claims
       payload = verify_auth0_token(token)

       # Extract user info from verified token
       auth0_id = payload["sub"]
       email = payload.get("email")
       name = payload.get("name", email)

       # Get or create user (SAFE because token is verified)
       user_service = UserService(session)
       user = await user_service.get_by_auth0_id(auth0_id)

       if not user:
           user = await user_service.create({
               "auth0_id": auth0_id,
               "email": email,
               "name": name
           })

       return user
   ```

   **Using the authentication dependency:**

   ```python
   # All protected endpoints use get_current_user dependency

   @router.get("/users/me", response_model=UserOut)
   async def get_current_user_info(
       current_user: User = Depends(get_current_user)
   ):
       """Current user (auto-created if first login)"""
       return current_user

   @router.post("/workspaces/{workspace_id}/programs")
   async def create_program(
       workspace_id: UUID,
       body: ProgramCreate,
       current_user: User = Depends(get_current_user)  # ← Token validated here
   ):
       # Token verified, user authenticated, auto-created if needed
       # Override author_id with authenticated user
       body.author_id = current_user.id

       svc = ProgramService(session)
       return await svc.create_under_workspace(workspace_id, body)
   ```

   **Frontend sends token with every request:**

   ```tsx
   // Frontend service calls include token
   export async function getCurrentUser(accessToken: string): Promise<User> {
     const url = buildApiUrl("/users/me");
     return fetchAndCheck<User>(url, {
       method: "GET",
       headers: {
         Authorization: `Bearer ${accessToken}`, // ← Token sent here
       },
       credentials: "include", // Send cookies too
     });
   }
   ```

   - Send access token in Authorization header for every API request
   - Backend validates token with Auth0 on every request
   - Backend extracts auth0_id from verified token (cannot be forged)
   - Backend auto-creates user on first authenticated request
   - Never trust user data from the client - always verify token
   - Never accept author_id from request body - use authenticated user

3. **Protected Routes**
   - Wrap protected pages with authentication check
   - Redirect to login if not authenticated
   - Show loading state while checking auth

### Auth0 Setup Checklist

#### In Auth0 Dashboard:

1. **Create Application**

   - Type: Single Page Application (SPA)
   - Copy Client ID and Domain

2. **Configure Application URLs**

   - Allowed Callback URLs: `http://localhost:3000, https://slodi.is`
   - Allowed Logout URLs: `http://localhost:3000, https://slodi.is`
   - Allowed Web Origins: `http://localhost:3000, https://slodi.is`

3. **Create API**

   - Name: "Slóði API"
   - Identifier: `https://api.slodi.is` (your audience)
   - Signing Algorithm: RS256

4. **Configure API Scopes** (optional for future)

   - `read:programs`
   - `write:programs`
   - `read:profile`
   - `write:profile`

5. **Enable Refresh Tokens** (in API settings)
   - Allow Offline Access: ON

#### Environment Variables:

```env
# Frontend (.env.local)
NEXT_PUBLIC_AUTH0_DOMAIN=slodi.eu.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_AUTH0_AUDIENCE=https://api.slodi.is

# Backend (.env)
AUTH0_DOMAIN=slodi.eu.auth0.com
AUTH0_AUDIENCE=https://api.slodi.is
AUTH0_ALGORITHMS=["RS256"]
```

---

## 🎯 Simplified Implementation Plan

### Phase 1: Backend Auth Setup (Do First!)

1. **Add dependencies to pyproject.toml**

   - Already added: `python-jose[cryptography]>=3.3.0` and `httpx>=0.27.0`
   - Install with:

   ```bash
   cd backend
   uv sync
   ```

2. **Create auth configuration**

   - [x] Create `backend/app/core/config.py` with Auth0 settings
   - [x] Add environment variables to `backend/.env`
   - Auth0 settings added to `app/settings.py`: `auth0_domain`, `auth0_audience`, `auth0_algorithms`
   - Config module created at `app/core/config.py` that re-exports settings

3. **Create auth module**

   - [x] Create `backend/app/core/auth.py` with:
     - `get_auth0_jwks()` - Fetch Auth0 public keys ✓
     - `verify_auth0_token()` - Complete JWT verification ✓
     - `get_current_user()` - Auth dependency with auto-creation ✓
   - Module includes:
     - JWKS caching with `@lru_cache()` for performance
     - Complete JWT signature verification with Auth0 public keys
     - Token expiration, audience, and issuer validation
     - Automatic user creation on first authenticated request
     - Comprehensive error handling with detailed messages

4. **Add user lookup method**

   - [x] Add `UserService.get_by_auth0_id()` method ✓
   - Added to `app/services/users.py`
   - Returns `User | None` (model instance, not UserOut schema)
   - Used by `get_current_user()` dependency for authentication

5. **Add /users/me endpoint**

   - [x] Created `GET /users/me` endpoint ✓
   - Location: `app/routers/users.py`
   - Uses `Depends(get_current_user)` for authentication
   - Returns current authenticated user (auto-creates on first login)
   - Positioned before parametric routes to ensure proper matching

   ```python
   @router.get("/me", response_model=UserOut)
   async def get_current_user_endpoint(
       current_user: Annotated[User, Depends(get_current_user)],
   ):
       """Get current authenticated user (auto-creates user on first login)"""
       return current_user
   ```

6. **Protect existing endpoints**
   - [ ] Add `current_user: User = Depends(get_current_user)` to all protected routes
   - [ ] Override `author_id` with `current_user.id` in program creation

### Phase 2: Frontend Auth Setup

**Current Status: Partially Complete** ✅🟡

#### ✅ Already Implemented:

1. **Auth0 SDK Installed**

   - ✅ `@auth0/nextjs-auth0` v4.10.0 installed in package.json
   - Using Next.js App Router SDK (not React SPA SDK)

2. **Environment Configuration Exists**

   - ✅ `.env.example` has Auth0 variables template
   - ✅ `.env` file exists (needs verification of values)
   - Variables needed:
     - `AUTH0_DOMAIN`
     - `AUTH0_CLIENT_ID`
     - `AUTH0_CLIENT_SECRET`
     - `AUTH0_SECRET` (32-char random)
     - `AUTH0_AUDIENCE` (for backend API)
     - `AUTH0_SCOPE` (openid profile email)

3. **Auth0 SDK Integration**
   - ✅ `lib/auth0.ts` - Auth0 client initialized
   - ✅ `app/api/auth/[auth0]/route.ts` - Dynamic route for Auth0 endpoints
   - ✅ `useUser()` hook already used in Header and DashboardLayout components
   - Login/logout routes: `/auth/login`, `/auth/logout`, `/auth/me`

#### 🟡 Needs Implementation:

4. **Create AuthContext** ✅ COMPLETE

   - [x] Created `contexts/AuthContext.tsx` that wraps Auth0's `useUser()`
   - [x] Fetches backend user data via `GET /users/me` after Auth0 authentication
   - [x] Provides `getToken()` function for API calls
   - [x] Created `hooks/useAuth.ts` for easy access
   - [x] Created `/api/auth/token` route to get access tokens server-side
   - Implementation uses `@auth0/nextjs-auth0` Next.js SDK
   - Tokens obtained via server-side API route for security

5. **Create user service** ✅ COMPLETE

   - [x] Created `services/users.service.ts` with:
     - `getCurrentUser(token: string): Promise<User>` - calls `GET /users/me`
     - `updateCurrentUser(token, updates)` - updates user profile
     - `User` type definition matching backend
   - Used by AuthContext to fetch backend user data

6. **Add auth helper to api.ts** ✅ COMPLETE

   - [x] Updated `lib/api.ts` with `fetchWithAuth()` function
   - Adds Authorization header with Bearer token
   - Handles 401 errors by redirecting to login
   - Ready for use in services

7. **Update program service** 🔴 REQUIRED FOR PROGRAM CREATION

   - [ ] Update `createProgram()` to accept `getToken` parameter
   - [ ] Remove `authorId` from `ProgramCreateInput` (backend uses authenticated user)
   - [ ] Use `fetchWithAuth()` helper instead of direct fetch
   - Current: `services/programs.service.ts` has no authentication

8. **Wrap app with AuthProvider** ✅ COMPLETE
   - [x] Updated `app/layout.tsx` to include AuthContext provider
   - [x] Wrapped with both `UserProvider` (Auth0 SDK) and `AuthProvider` (custom)
   - Properly nested: UserProvider → AuthProvider → other providers
   - All components now have access to auth context

#### Implementation Notes:

**Important SDK Difference:**
The docs suggest `@auth0/auth0-react` (SPA SDK), but the project uses `@auth0/nextjs-auth0` (Next.js SDK).

Key differences:

- ✅ Use `useUser()` instead of `useAuth0()`
- ✅ Use `getAccessToken()` from `@auth0/nextjs-auth0` server utils
- ✅ Auth routes handled by `/api/auth/[auth0]` dynamic route
- ❌ No `Auth0Provider` wrapper needed (SDK handles it internally)
- ❌ No `loginWithRedirect()` - use `<a href="/auth/login">`

**Next Steps Priority:**

1. Create `contexts/AuthContext.tsx` (wraps useUser + fetches backend user)
2. Create `services/users.service.ts` (getCurrentUser function)
3. Update `lib/api.ts` (add fetchWithAuth helper)
4. Update `services/programs.service.ts` (use authentication)
5. Wrap app in AuthProvider in `layout.tsx`

### Phase 3: Connect Everything

1. **Add login/logout UI**

   - [ ] Add login button to header/landing page
   - [ ] Add logout button to user menu

2. **Protect program creation**

   - [ ] Update `NewProgramForm` to use `getToken` from `useAuth()`
   - [ ] Remove `authorId` prop
   - [ ] Show loading state while submitting

3. **Add protected routes**

   - [ ] Wrap protected pages with auth check
   - [ ] Redirect to login if not authenticated
   - [ ] Show loading state during auth check

4. **Test complete flow**
   - [ ] Test signup: Auth0 → auto-create user → create program
   - [ ] Test login: existing user → fetch from backend → create program
   - [ ] Test logout: clear session → redirect to home
   - [ ] Test token refresh: works automatically via Auth0 SDK

---

## Next Steps

1. **Immediate**: Set up Auth0 account and get credentials
2. **Then**: Implement AuthContext and basic login/logout
3. **Then**: Implement backend user creation flow
4. **Finally**: Connect user ID to program creation
   ✅ **Never store tokens in localStorage/state** - Use httpOnly cookies
5. ✅ **Validate JWT signature with Auth0 public key** - Check expiration, audience, issuer
6. ✅ **Backend overrides author_id** - Never trust author_id from client request
7. ✅ **Use Authorization header** - Send `Bearer {token}` with every API call
8. ⚠️ **Implement token refresh** - Handle expired tokens gracefully
9. ⚠️ **Protected routes** - Require authentication for sensitive operations

## Common Security Anti-Patterns to AVOID

### ❌ 1. Client-Side User Creation

```tsx
// NEVER do this - anyone can call this endpoint
if (!user) {
  await createUser({ auth0_id: "fake-id" });
}
```

### ❌ 2. Storing Tokens in State/localStorage

```tsx
// NEVER do this - exposed to XSS
setUser({ accessToken });
localStorage.setItem("token", token);
```

### ❌ 3. Trusting author_id from Client

```python
# NEVER do this - client can send any author_id
@router.post("/programs")
async def create_program(body: ProgramCreate):
    # body.author_id could be fake!
    return await create(body)
```

### ❌ 4. Skipping Token Validation

```python
# NEVER do this - tokens can be forged/expired
async def get_user(token: str):
    payload = jwt.decode(token, verify=False)  # DANGEROUS!
```

### ❌ 5. Frontend Querying User Existence (User Enumeration)

```tsx
// ❌ BAD: Exposes which users exist in system
let backendUser = await getUserByAuth0Id(auth0User.sub);
if (!backendUser) {
  // Attacker can enumerate valid users
}
```

**Problem:** Allows attackers to enumerate valid users by checking which auth0_ids exist.

**✅ Better:** Backend handles everything in `/auth/callback` endpoint

### ❌ 6. Hardcoded Workspace IDs

```tsx
// ❌ BAD: Hardcoded workspace
const workspaceId = "36606c77-5e0d-4fc9-891f-4e0126c6e9a6";
```

**Problem:** Not flexible, doesn't scale with multiple workspaces.

**✅ Better:** Get workspace from:

- URL parameter: `/workspaces/{id}/programs`
- User's workspace memberships
- Default workspace from user preferences

### ✅ Correct Patterns

1. **Backend verifies all tokens** with Auth0 public key
2. **Backend extracts user info** from verified token
3. **Backend auto-creates users** on first authenticated request
4. **Backend stores session** in httpOnly cookies
5. **Backend overrides author_id** with authenticated user
6. **Backend handles Auth0 callback** - frontend never queries user existence
7. **Dynamic workspace IDs** from URL/user context

---

## 🔧 Recommended Secure Architecture

### Improved Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              SECURE AUTHENTICATION FLOW (REVISED)                │
└─────────────────────────────────────────────────────────────────┘

1. User clicks login
   │
   ├─→ Frontend: loginWithRedirect()
   │
2. Auth0 login page
   │
   ├─→ User authenticates
   ├─→ Auth0 validates credentials
   │
3. Auth0 redirects to callback URL with authorization code
   │
   ├─→ Frontend receives: ?code=xyz123
   │
4. Frontend sends code to backend
   │
   ├─→ POST /auth/callback { code: "xyz123" }
   │
5. Backend handles everything (secure server-side):
   │
   ├─→ Exchange code for tokens with Auth0
   ├─→ Verify token with Auth0 public key
   ├─→ Extract auth0_id, email, name from verified token
   ├─→ Check if user exists by auth0_id
   ├─→ Create user if doesn't exist (SAFE - token verified)
   ├─→ Create secure session cookie
   │   • httpOnly: true
   │   • secure: true (HTTPS only)
   │   • sameSite: 'strict'
   │
6. Backend returns user data (no tokens!)
   │
   ├─→ Response: { id, auth0_id, email, name }
   ├─→ Set-Cookie: session=encrypted_jwt; HttpOnly; Secure; SameSite=Strict
   │
7. Frontend stores user in context
   │
   ├─→ setUser({ id, auth0_id, email, name })
   ├─→ NO token storage in frontend!
   │
8. All subsequent API calls
   │
   ├─→ Browser automatically sends session cookie
   ├─→ Backend validates session cookie
   ├─→ Backend returns data
```

### Required Backend Endpoints

#### 1. **POST /auth/callback**

```python
@router.post("/auth/callback")
async def auth_callback(
    code: str,
    response: Response,
    session: AsyncSession = Depends(get_session)
):
    """
    Handles Auth0 callback:
    1. Exchange authorization code for tokens with Auth0
    2. Verify token
    3. Get/create user (server-side)
    4. Create session cookie
    5. Return user data
    """
    # Exchange code for tokens with Auth0
    token_response = await exchange_code_for_token(code)
    access_token = token_response["access_token"]

    # Verify token and get user info
    payload = verify_auth0_token(access_token)
    auth0_id = payload["sub"]
    email = payload.get("email")
    name = payload.get("name", email)

    # Get or create user (SAFE because token is verified)
    user_service = UserService(session)
    user = await user_service.get_by_auth0_id(auth0_id)

    if not user:
        user = await user_service.create({
            "auth0_id": auth0_id,
            "email": email,
            "name": name
        })

    # Create secure session cookie
    session_token = create_session_token(user.id)

    response.set_cookie(
        key="session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7200,  # 2 hours
    )

    return user
```

#### 2. **GET /auth/me**

```python
@router.get("/auth/me", response_model=UserOut)
async def get_current_session(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """
    Reads session cookie and returns current user.
    Used to restore session on page load.
    """
    session_token = request.cookies.get("session")

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Verify session token and get user ID
    user_id = verify_session_token(session_token)

    # Get user from database
    user_service = UserService(session)
    user = await user_service.get(user_id)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")

    return user
```

#### 3. **POST /auth/logout**

```python
@router.post("/auth/logout")
async def logout(response: Response):
    """Clears session cookie"""
    response.delete_cookie(key="session")
    return {"message": "Logged out successfully"}
```

### Updated Frontend AuthProvider

```tsx
// contexts/AuthContext.tsx

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { loginWithRedirect, handleRedirectCallback } = useAuth0();

  // On mount, check if session exists
  useEffect(() => {
    checkSession();
  }, []);

  // Handle Auth0 callback
  useEffect(() => {
    const handleCallback = async () => {
      if (window.location.search.includes("code=")) {
        try {
          // Get authorization code from URL
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get("code");

          if (code) {
            // Send code to backend
            const user = await fetch("/api/auth/callback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
              credentials: "include", // Send/receive cookies
            }).then((r) => r.json());

            setUser(user);

            // Clean up URL
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }
        } catch (err) {
          console.error("Auth callback error:", err);
        }
      }
    };

    handleCallback();
  }, []);

  async function checkSession() {
    try {
      // Backend reads httpOnly cookie
      const user = await fetch("/api/auth/me", {
        credentials: "include", // Send cookies
      }).then((r) => {
        if (!r.ok) throw new Error("No session");
        return r.json();
      });

      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login() {
    // Redirect to Auth0
    await loginWithRedirect({
      redirectUri: window.location.origin + "/callback",
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refetch: checkSession,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Dynamic Workspace ID Implementation

```tsx
// app/workspaces/[workspaceId]/programs/page.tsx

export default function ProgramsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // Or get from user's workspaces
  const { user } = useAuth();
  const { workspaces } = useWorkspaces(user?.id);
  const defaultWorkspace = workspaces?.[0]?.id;

  // Use URL param or fallback to default
  const activeWorkspaceId = workspaceId || defaultWorkspace;

  const { programs, loading, error, refetch } = usePrograms(activeWorkspaceId);

  // Rest of component...
}
```

---

## ✅ Final Security Checklist

### Backend Security

- [ ] Verify JWT signature with Auth0 JWKS (public keys)
- [ ] Check token expiration, audience, and issuer claims
- [ ] Extract `auth0_id` from verified token only
- [ ] Auto-create users only after token verification
- [ ] Override `author_id` with `current_user.id` from auth dependency
- [ ] Protect all sensitive endpoints with `Depends(get_current_user)`
- [ ] Use HTTPS only in production
- [ ] Implement rate limiting on API endpoints
- [ ] Implement CORS with specific allowed origins
- [ ] Log authentication attempts and failures

### Frontend Security

- [ ] Never store tokens in localStorage/sessionStorage
- [ ] Never store tokens in React state
- [ ] Let Auth0 SDK manage token storage and refresh
- [ ] Call `getAccessTokenSilently()` for fresh tokens
- [ ] Send tokens in `Authorization: Bearer {token}` header
- [ ] Frontend never queries user existence (no enumeration)
- [ ] Don't expose internal user IDs in URLs
- [ ] Validate and sanitize all user inputs
- [ ] Don't leak sensitive info in error messages
- [ ] Handle 401 errors by redirecting to login

### Testing & Monitoring

- [ ] Test signup flow: Auth0 → auto-create → use app
- [ ] Test login flow: Auth0 → fetch user → use app
- [ ] Test token refresh: automatic via Auth0 SDK
- [ ] Test logout: clear Auth0 session
- [ ] Monitor auth failures for suspicious patterns
- [ ] Set up alerts for security events

---

## ❓ Questions to Clarify

### Tags Implementation

You need to clarify with the backend team:

**Option A: Backend creates tags automatically**

```python
# Frontend sends tag strings
{ "tags": ["útivera", "leikir"] }

# Backend creates tags if they don't exist and associates them
```

**Option B: Frontend must create tags first**

```typescript
// 1. Create tags first
const tagIds = await Promise.all(
  selectedTags.map((name) => createTag({ name }))
);

// 2. Associate with program
await createProgram({
  ...data,
  tag_ids: tagIds.map((t) => t.id),
});
```

**Recommendation:** Option A is simpler - backend should handle tag creation/association automatically.creates on first auth 2. How should we handle the access token for backend API authentication? (Authorization header with Bearer token) 3. Should we use httpOnly cookies or local storage for session management? 4. ✅ ~~Do we need to verify the Auth0 token on the backend?~~ **Yes** - Verify on EVERY API call 5. How should we handle user profile updates (name, email changes)? 6. What Auth0 scopes/permissions do we need for the API? 7. How do we handle token refresh when it expires?

## Security Best Practices Summary

1. ✅ **Never trust client-provided user data** - Always verify Auth0 token
2. ✅ **Backend controls user creation** - Only create users with verified tokens
3. ✅ **Token verification on every request** - Use middleware/dependency injection
4. ✅ **Extract auth0_id from verified token** - Never accept it from request body
5. ⚠️ **Use Authorization header** - Send `Bearer {token}` with every API call
6. ⚠️ **Implement token refresh** - Handle expired tokens gracefully
7. ⚠️ **Protected routes** - Require authentication for sensitive operationstion?
8. Should we use httpOnly cookies or local storage for session management?
9. Do we need to verify the Auth0 token on the backend for every API call?
10. How should we handle user profile updates (name, email changes)?
