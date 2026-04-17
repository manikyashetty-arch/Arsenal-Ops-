# Migration: localStorage to HttpOnly Cookies

## Overview
Switch from localStorage-based JWT token storage to secure HttpOnly cookies for better security against XSS attacks and CSRF vulnerabilities.

## Security Comparison

| Aspect | Cookies (HttpOnly) | localStorage |
|--------|------------------|--------------|
| **XSS Vulnerability** | ✅ HttpOnly flag prevents JS access (most secure) | ❌ Vulnerable to XSS attacks |
| **CSRF Protection** | ✅ SameSite attribute provides built-in CSRF defense | ❌ No built-in CSRF protection |
| **Automatic Sending** | ✅ Auto-sent with every HTTP request | ❌ Must manually add to Authorization header |
| **Storage Size** | ❌ Limited (~4KB per cookie) | ✅ 5-10MB available |
| **Silent Refresh** | ✅ Can implement token refresh automatically | ⚠️ Must handle expiration manually |
| **Cross-Domain Control** | ✅ Domain/Path attributes for fine control | ❌ Same-origin only |

**Recommendation:** Use HttpOnly Cookies - most secure for JWT authentication

## Frontend Changes Required

### File: `app/src/contexts/AuthContext.tsx`

**9 locations to update:**

1. **Line 52-57**: Remove user restoration from localStorage
   ```tsx
   // DELETE: const savedUser = localStorage.getItem('user');
   // CHANGE: Get user from API call instead
   ```

2. **Line 63**: Remove token restoration from localStorage
   ```tsx
   // DELETE: const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
   // CHANGE: const [token, setToken] = useState<string | null>(null);
   ```

3. **Line 128**: Remove token fallback from localStorage in `checkAuth()`
   ```tsx
   // OLD: const currentToken = token || localStorage.getItem('token');
   // NEW: const currentToken = token;
   // NOTE: Token will come from cookies automatically
   ```

4. **Lines 179-180**: Remove localStorage.setItem in `login()`
   ```tsx
   // DELETE: localStorage.setItem('token', data.access_token);
   // DELETE: localStorage.setItem('user', JSON.stringify(data.user));
   // NOTE: Backend sets cookie automatically
   ```

5. **Lines 202-203**: Remove localStorage.setItem in `loginWithGoogle()`
   ```tsx
   // DELETE: localStorage.setItem('token', data.access_token);
   // DELETE: localStorage.setItem('user', JSON.stringify(data.user));
   ```

6. **Lines 213-214**: Remove localStorage.removeItem in `logout()`
   ```tsx
   // DELETE: localStorage.removeItem('token');
   // DELETE: localStorage.removeItem('user');
   // NOTE: Call backend logout endpoint to clear cookie
   ```

7. **Update `checkAuth()` fetch**: Add credentials option
   ```tsx
   const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
     credentials: 'include'  // ADD THIS - sends cookies with request
   });
   ```

8. **Update `login()` fetch**: Add credentials option
   ```tsx
   const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
     method: 'POST',
     credentials: 'include',  // ADD THIS
     // ... rest of config
   });
   ```

9. **Update `loginWithGoogle()` fetch**: Add credentials option
   ```tsx
   const response = await fetch(`${API_BASE_URL}/api/auth/google-login`, {
     method: 'POST',
     credentials: 'include',  // ADD THIS
     // ... rest of config
   });
   ```

### File: `app/src/App.tsx`

**3 locations** store redirect path (these can stay as localStorage - not sensitive):
- Line 74: `localStorage.setItem('intendedPath', ...)`
- Line 82: `localStorage.getItem('intendedPath')`
- Line 83: `localStorage.removeItem('intendedPath')`

These are safe to keep since `intendedPath` is not sensitive data.

## Backend Changes Required

### File: `backend/routers/auth.py`

**Update all login endpoints** to set HttpOnly cookie instead of returning token:

```python
from fastapi import Response
from fastapi.responses import JSONResponse

# In login endpoint (around line 154):
response = JSONResponse({
    "user": user_dict,
    "message": "Login successful"
})
response.set_cookie(
    key="access_token",
    value=access_token,
    max_age=86400,  # 24 hours = 60 * 60 * 24
    httponly=True,  # Prevents JavaScript access (XSS protection)
    secure=True,    # HTTPS only (set False for local development)
    samesite="Lax"  # CSRF protection
)
return response

# Similar for Google login endpoint (around line 475)
```

**Update logout endpoint** to clear the cookie:
```python
@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=True,
        samesite="Lax"
    )
    return {"message": "Logged out successfully"}
```

**Update authentication dependency** to read from cookies:
```python
from fastapi import Cookie, Depends

async def get_current_user(access_token: str = Cookie(None)) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # ... rest of validation
```

## Implementation Checklist

- [ ] Create backend logout endpoint that clears cookie
- [ ] Update all login endpoints to set HttpOnly cookie
- [ ] Update auth dependency to read from cookie
- [ ] Update AuthContext.tsx to remove localStorage usage
- [ ] Add `credentials: 'include'` to all fetch calls
- [ ] Remove token state restoration from localStorage
- [ ] Remove manual token setting to localStorage
- [ ] Test with browser DevTools (Cookies tab)
- [ ] Verify token not accessible via `document.cookie`
- [ ] Test 24-hour session timeout
- [ ] Test manual logout
- [ ] Test Google OAuth login with cookies
- [ ] Update CORS settings if needed (allow credentials)

## Testing

1. **Check cookie is HttpOnly**
   - Open DevTools → Application → Cookies
   - Find `access_token` cookie
   - Should NOT be accessible via Console: `document.cookie`

2. **Check credentials are sent**
   - DevTools → Network → Any API call
   - Headers should show `Cookie: access_token=...`

3. **Test logout**
   - Call logout endpoint
   - Cookie should be deleted (or max_age=0)
   - Subsequent API calls should fail without token

## Notes

- **Development vs Production**: Set `secure=False` for local development (localhost), `secure=True` for production
- **CORS**: May need to update CORS configuration to include `credentials: true`
- **Session Restoration**: User will only be restored if token cookie is valid (more secure)
- **XSS Attack**: Even if XSS occurs, attacker cannot access the token (it's HttpOnly)
