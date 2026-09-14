import datetime

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import status
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.generics import CreateAPIView, UpdateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import UserConfirmation
from shared.utility import send_email, check_email_or_phone
from .models import User
from .constants import AuthStatus, AuthType, ConfirmationPurpose
from .serilalizers import SignUpSerializer, ChangeUserInformationSerializer, LoginSerializer, \
    LoginRefreshSerializer, LogoutSerializer, ResetPasswordSerializer, ForgotPasswordSerializer


class SignUpView(CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = SignUpSerializer
    queryset = User.objects.all()

class VerifyView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        user = self.request.user
        code = self.request.data.get('code')

        try:
            code = int(code)
        except ValueError:
            raise ValidationError("Invalid verification code.")

        verify = self.check_verify(user, code)

        if verify.purpose == ConfirmationPurpose.SIGNUP:
            if user.auth_status == AuthStatus.NEW:
                user.auth_status = AuthStatus.CODE_VERIFIED
                user.save()

            return Response(
                data={
                    "success": True,
                    "auth_status": user.auth_status,
                    "access": user.token()['access'],
                    "refresh": user.token()['refresh']
                }
            )

        if verify.purpose == ConfirmationPurpose.FORGOT_PASSWORD:
            return Response(
                data={
                    "success": True,
                    "message": "Verification successful.",
                    "reset_token": user.token()['access']
                }
            )

    @staticmethod
    def check_verify(user, code):
        verify = user.verify_codes.filter(
            expiration_time__gte=datetime.datetime.now(),
            code=code,
            is_confirmed=False
        ).first()

        if not verify:
            raise ValidationError({
                "message": "Your verification code has expired or incorrect.",
            })

        verify.is_confirmed = True
        verify.save()

        return verify
class GetNewVerifyView(APIView):
    permission_classes = [IsAuthenticated]


    def get(self, request, *args, **kwargs):
        user = self.request.user
        self.check_verification(user)
        if user.auth_type == (AuthType.VIA_EMAIL):
            code = user.create_verify_code(AuthType.VIA_EMAIL)
            send_email(user.email, code)
        elif user.auth_type == (AuthType.VIA_PHONE):
            code = user.create_verify_code(AuthType.VIA_PHONE)
            send_email(user.phone_number, code)
        else:
            data = {
                "message": "Email or phone number is incorrect.",
            }
            raise ValidationError(data)
        return Response(
            data={
                "success": True,
                "message": "Your verification code has been resent.",

            }
        )
    @staticmethod
    def check_verification(user):
        verifies =user.verify_codes.filter(expiration_time__gte=datetime.datetime.now(), is_confirmed=False)
        if verifies.exists():
            data = {
                "message": "Your verification code is available.",
            }
            raise ValidationError(data)


class ChangeUserInformationView(UpdateAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = ChangeUserInformationSerializer
    http_method_names = ['patch', 'put']

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        super(ChangeUserInformationView, self).update(request, *args, **kwargs)
        data = {
            "success": True,
            "message": "User updated successfully.",
            "auth_status": self.request.user.auth_status,
        }

        return Response(data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        super(ChangeUserInformationView, self).partial_update(request, *args, **kwargs)
        data = {
            "success": True,
            "message": "User updated successfully.",
            "auth_status": self.request.user.auth_status,
        }

        return Response(data, status=status.HTTP_200_OK)

class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer

class LoginRefreshView(TokenRefreshView):
    serializer_class = LoginRefreshSerializer

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LogoutSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=self.request.data)
        serializer.is_valid(raise_exception=True)
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            data={
                "success": True,
                "message": "You are logged out successfully.",
            }
            return Response(data, status=205)
        except TokenError:
            return Response(status=400)



class ForgetPasswordView(APIView):
    permission_classes = (AllowAny,)
    serializer_class = ForgotPasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=self.request.data)
        serializer.is_valid(raise_exception=True)
        email_or_phone = serializer.validated_data.get('email_or_phone')
        user = serializer.validated_data.get('user')
        if check_email_or_phone(email_or_phone) == 'phone':
            code = user.create_verify_code(AuthType.VIA_PHONE, ConfirmationPurpose.FORGOT_PASSWORD)
            send_email(email_or_phone, code)
        elif check_email_or_phone(email_or_phone) == 'email':
            code = user.create_verify_code(AuthType.VIA_EMAIL, ConfirmationPurpose.FORGOT_PASSWORD)
            send_email(email_or_phone, code)

        return Response(
            {
                "success": True,
                'message': "verify code send successfully.",
                "user_status": user.auth_status,
            }, status=200
        )



class ResetPasswordView(UpdateAPIView):
    serializer_class = ResetPasswordSerializer
    permission_classes = [IsAuthenticated, ]
    http_method_names = ['patch', 'put']

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        response = super(ResetPasswordView, self).update(request, *args, **kwargs)
        try:
            user = User.objects.get(id=response.data.get('id'))
        except ObjectDoesNotExist as e:
            raise NotFound(detail='User not found')
        return Response(
            {
                'success': True,
                'message': "Password change successfully.",
                'access': user.token()['access'],
                'refresh': user.token()['refresh'],
            }
        )