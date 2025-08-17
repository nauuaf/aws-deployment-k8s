import httpx
from src.config import get_settings

class AuthService:
    def __init__(self):
        self.settings = get_settings()
        self.auth_url = self.settings.auth_service_url
    
    async def verify_token(self, token: str):
        """Verify JWT token with auth service"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.auth_url}/verify",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5.0
                )
                return response.status_code == 200
        except Exception as e:
            print(f"Auth verification failed: {e}")
            return False
