# System Administrator Specification

## Current State Analysis

### Existing Role System

The Slóði platform currently has **two scoped role systems**:

1. **WorkspaceRole** (`backend/app/models/workspace.py`)
   - `owner` - Full control over workspace
   - `admin` - Administrative access within workspace
   - `editor` - Can edit content
   - `viewer` - Read-only access
   - Scope: Per workspace only

2. **GroupRole** (`backend/app/models/group.py`)
   - `owner` - Full control over group
   - `admin` - Administrative access within group
   - `editor` - Can edit content
   - `viewer` - Read-only access
   - Scope: Per group only

### Gap Identified

**There is NO system-wide/platform-level administrator role.**

This means:
- No way to designate users who can manage system-level resources
- No way to protect platform-wide endpoints (like email list management, system settings, global analytics)
- Admin functionality in `/admin` route has no backend enforcement mechanism
- Cannot distinguish between workspace admins and platform maintainers

## Proposed Solution

### Add System Admin Flag to User Model

Add a boolean field to the `User` model to indicate system-level administrator status:

```python
# backend/app/models/user.py

class User(Base):
    __tablename__ = "users"
    
    # ... existing columns ...
    
    is_system_admin: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
        index=True,  # For efficient filtering
    )
```

### Why a Boolean Flag vs. Role System?

**Advantages of boolean flag:**
- **Simplicity**: System admins are a special class, not a hierarchy
- **Clear separation**: Workspace/Group roles are contextual, system admin is global
- **Performance**: Single boolean check vs. joining membership tables
- **Maintenance**: Easier to manage - no need for system-wide "membership" records

**When it's appropriate:**
- Small number of system admins (typically 1-5 for a platform)
- Binary permission (you are or aren't a system admin)
- No need for graduated system permissions

**Future considerations:** If we need tiered system permissions (e.g., "platform viewer", "platform editor", "platform admin"), we could introduce a `SystemRole` enum later.

## Implementation Plan

### 1. Database Migration

```python
# backend/alembic/versions/XXXXXX_add_system_admin.py

def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('is_system_admin', sa.Boolean(), nullable=False, server_default='false')
    )
    op.create_index('ix_users_is_system_admin', 'users', ['is_system_admin'])

def downgrade() -> None:
    op.drop_index('ix_users_is_system_admin', 'users')
    op.drop_column('users', 'is_system_admin')
```

### 2. Update Models and Schemas

**Model** (`backend/app/models/user.py`):
```python
is_system_admin: Mapped[bool] = mapped_column(
    nullable=False,
    default=False,
    index=True,
)
```

**Schema** (`backend/app/schemas/user.py`):
```python
class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    email: EmailConstrained
    auth0_id: Auth0Id
    is_system_admin: bool  # Add to output schema

# Note: Do NOT include in UserCreate or UserUpdate to prevent self-elevation
```

### 3. Create Admin Dependency

**Auth helper** (`backend/app/core/auth.py`):
```python
async def require_system_admin(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Dependency that ensures the current user is a system administrator.
    
    Raises:
        HTTPException: 403 if user is not a system admin
    """
    if not current_user.is_system_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System administrator access required"
        )
    return current_user

# Type alias for convenience
SystemAdminDep = Annotated[User, Depends(require_system_admin)]
```

### 4. Protect Sensitive Endpoints

**Example: Email List Management** (`backend/app/routers/email_list.py`):
```python
from app.core.auth import SystemAdminDep

@router.get("/", response_model=list[EmailListOut])
async def list_email_list(
    session: SessionDep,
    admin: SystemAdminDep  # Only system admins can view email list
):
    svc = EmailListService(session)
    return await svc.list()
```

**Other endpoints to protect:**
- System settings management
- Global analytics
- User management (list all users, deactivate users)
- Feature flag management
- Audit log access
- Content moderation queue

### 5. Admin Management Endpoint

Create protected endpoints for managing system admin status:

```python
# backend/app/routers/system_admin.py

router = APIRouter(prefix="/system-admin", tags=["system-admin"])

@router.post("/grant/{user_id}")
async def grant_system_admin(
    user_id: UUID,
    session: SessionDep,
    admin: SystemAdminDep  # Only existing admins can grant
) -> UserOut:
    """Grant system admin privileges to a user."""
    # Implementation
    pass

@router.delete("/revoke/{user_id}")
async def revoke_system_admin(
    user_id: UUID,
    session: SessionDep,
    admin: SystemAdminDep
) -> UserOut:
    """Revoke system admin privileges from a user."""
    # Implementation
    pass

@router.get("/list")
async def list_system_admins(
    session: SessionDep,
    admin: SystemAdminDep
) -> list[UserOut]:
    """List all system administrators."""
    # Implementation
    pass
```

### 6. Seeding Initial Admin

For initial setup, create a management command or use environment variables:

```python
# backend/app/utils/seed_admin.py

async def seed_initial_admin(email: str):
    """
    Promote a user to system admin by email.
    
    Usage: python -m app.utils.seed_admin admin@example.com
    """
    async with get_session() as session:
        user = await session.execute(
            select(User).where(User.email == email.lower())
        )
        user = user.scalar_one_or_none()
        
        if not user:
            raise ValueError(f"User with email {email} not found")
        
        user.is_system_admin = True
        await session.commit()
        print(f"✓ Granted system admin to {user.name} ({user.email})")
```

**Alternative: Environment variable on first user creation:**
```python
# In user creation logic
FIRST_ADMIN_EMAIL = os.getenv("SLODI_FIRST_ADMIN_EMAIL")
if FIRST_ADMIN_EMAIL and user.email == FIRST_ADMIN_EMAIL.lower():
    user.is_system_admin = True
```

## Security Considerations

### Audit Logging

All system admin operations should be logged:
- Who was granted/revoked admin status
- When protected endpoints are accessed
- What changes were made using admin privileges

### Frontend Display

**User profile should show admin badge:**
```typescript
// frontend
interface UserProfile {
  id: string;
  name: string;
  email: string;
  is_system_admin: boolean;  // Show "System Admin" badge in UI
}
```

**Admin route protection:**
```typescript
// frontend/app/admin/layout.tsx
export default function AdminLayout({ children }) {
  const { user } = useAuth();
  
  if (!user?.is_system_admin) {
    return <AccessDenied />;
  }
  
  return <>{children}</>;
}
```

### Protection Against Privilege Escalation

**Important safeguards:**

1. **Cannot self-grant admin:**
   - `is_system_admin` should NOT be in `UserUpdate` schema
   - Only existing system admins can grant/revoke via dedicated endpoint

2. **Cannot create user as admin:**
   - `is_system_admin` should NOT be in `UserCreate` schema
   - Default is always `false`

3. **Require admin for modifications:**
   ```python
   # BAD - allows any authenticated user
   @router.post("/users/")
   async def create_user(data: UserCreate):
       pass
   
   # GOOD - requires system admin
   @router.post("/users/")
   async def create_user(data: UserCreate, admin: SystemAdminDep):
       pass
   ```

## Migration Strategy

1. **Phase 1: Database**
   - Create migration
   - Run migration in dev/staging
   - Manually set first admin: `UPDATE users SET is_system_admin = true WHERE email = 'admin@example.com';`

2. **Phase 2: Backend**
   - Update User model and schemas
   - Create `require_system_admin` dependency
   - Protect sensitive endpoints (start with email list)

3. **Phase 3: Frontend**
   - Update API types
   - Add admin badge to user profile
   - Protect `/admin` route

4. **Phase 4: Management**
   - Create admin management endpoints
   - Add admin management UI to `/admin/users`

## Future Enhancements

If more granular system permissions are needed, consider:

### Option A: System Role Enum
```python
class SystemRole(str, Enum):
    platform_viewer = "platform_viewer"   # Read analytics, audit logs
    platform_editor = "platform_editor"   # Manage content, templates
    platform_admin = "platform_admin"     # Full system control

is_system_admin: Mapped[bool]  # Keep for backward compatibility
system_role: Mapped[SystemRole | None]  # Graduated permissions
```

### Option B: System Capabilities
```python
# More flexible but complex
system_capabilities: Mapped[list[str]]  # ["users.manage", "content.moderate", "settings.edit"]
```

## References

- Current role system: `backend/app/models/workspace.py`, `backend/app/models/group.py`
- Auth system: `backend/app/core/auth.py`
- User model: `backend/app/models/user.py`
- Admin UI spec: `docs/frontend/admin.md`

## Decision Log

**2026-01-08**: Decided to use boolean `is_system_admin` flag rather than complex role hierarchy for initial implementation. This provides:
- Clear separation between workspace/group roles and platform administration
- Simple implementation and maintenance
- Sufficient for initial use cases (email list management, system settings)
- Can be extended later if graduated permissions are needed

---

**Status**: Proposed (not yet implemented)
**Owner**: Backend team
**Next Steps**: Review with team, create migration, implement backend auth check
