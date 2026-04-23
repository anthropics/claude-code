import logging

from django.conf import settings
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import AuthUser, JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import Token

logger = logging.getLogger(__name__)


class CookieAuthentication(JWTAuthentication):
    def authenticate(self, request: Request) -> tuple[AuthUser, Token] | None:
        header = self.get_header(request)
        raw_token = None

        if header is not None:
            raw_token = self.get_raw_token(header)
        elif settings.COOKIE_NAME in request.COOKIES:
            raw_token = request.COOKIES.get(settings.COOKIE_NAME)

        if raw_token is not None:
            try:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token

            except TokenError as e:
                logger.error(f"Token validation error: {e!s}")
        return None
