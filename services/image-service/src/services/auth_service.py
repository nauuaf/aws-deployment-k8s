import httpx
from src.config import get_settings

class AuthService:
    def __init__(self):
        self.settings = get_settings()
        self.auth_url = self.settings.auth_service_url
    
    async def verify_token(self, token: str):
        """Verify JWT token with auth service"""
        try:
            async with httpx.AsyncClient(verify=False) as client:  # Disable SSL verification for testing
                response = await client.post(
                    f"{self.auth_url}/verify",
                    json={"token": token},
                    headers={"Content-Type": "application/json"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    result = response.json()
                    return result.get("user") if result.get("valid") else None
                else:
                    print(f"Auth service returned {response.status_code}: {response.text}")
                    return None
        except Exception as e:
            print(f"Auth verification failed: {e}")
            # For development/demo, return a mock user when auth service is unavailable
            import os
            if os.getenv('ENVIRONMENT', 'production').lower() in ['development', 'poc', 'demo']:
                print("Using mock user for development")
                return {
                    "id": "mock-user-id",
                    "email": "demo@example.com",
                    "firstName": "Demo",
                    "lastName": "User",
                    "role": "user"
                }
            return None
