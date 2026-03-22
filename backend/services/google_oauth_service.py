"""
Google OAuth Service - Handle Google SSO authentication
Follows industry standard OAuth 2.0 flow
"""
import os
from typing import Optional, Dict, Any
from google.auth.transport import requests
from google.oauth2 import id_token
import logging

logger = logging.getLogger(__name__)


class GoogleOAuthService:
    """Service for handling Google OAuth authentication"""
    
    def __init__(self):
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        self.google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    def is_configured(self) -> bool:
        """Check if Google OAuth is configured"""
        return bool(self.google_client_id)
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify Google ID token and extract user information
        
        This follows the OAuth 2.0 standard:
        1. Client sends ID token from Google
        2. Backend verifies the token signature using Google's public keys
        3. Extracts user information (email, name, picture, sub)
        
        Args:
            token: Google ID token from frontend
        
        Returns:
            Dictionary with user info if valid, None if invalid
        """
        if not self.is_configured():
            logger.error("Google OAuth not configured")
            return None
        
        try:
            # Verify the token using Google's public keys
            # This validates the signature and expiration
            idinfo = id_token.verify_oauth2_token(
                token, 
                requests.Request(),
                self.google_client_id
            )
            
            # Verify the token is for this app
            if idinfo['aud'] != self.google_client_id:
                logger.error("Token audience mismatch")
                return None
            
            # Extract user information
            return {
                'email': idinfo['email'],             # Email address
                'name': idinfo.get('name', ''),       # Full name
                'email_verified': idinfo.get('email_verified', False)
            }
        
        except ValueError as e:
            logger.error(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            return None


# Create singleton instance
google_oauth_service = GoogleOAuthService()
