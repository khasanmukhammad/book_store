from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.generics import CreateAPIView, UpdateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from shared.utility import send_email, check_email_or_phone
from .models import User, UserConfirmation
from .constants import AuthStatus, AuthType, ConfirmationPurpose
from .serilalizers import SignUpSerializer, ChangeUserInformationSerializer, LoginSerializer, \
    LoginRefreshSerializer, LogoutSerializer, ResetPasswordSerializer, ForgotPasswordSerializer


class SignUpView(CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = SignUpSerializer
    queryset = User.objects.all()

class VerifyView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, *args, **kwargs):
        code = request.data.get("code")

        if not code:
            raise ValidationError({
                "message": "Verification code is required."
            })

        try:
            code = int(code)
        except (ValueError, TypeError):
            raise ValidationError({
                "message": "Invalid verification code."
            })

        # 1. Avval FORGOT_PASSWORD code ni tekshiramiz
        verify = UserConfirmation.objects.filter(
            code=code,
            purpose=ConfirmationPurpose.FORGOT_PASSWORD,
            expiration_time__gte=timezone.now(),
            is_confirmed=False
        ).select_related("user").first()

        if verify:
            verify.is_confirmed = True
            verify.save(update_fields=["is_confirmed"])

            user = verify.user

            return Response({
                "success": True,
                "message": "Verification successful.",
                "reset_token": user.token()["access"]
            })

        # 2. Agar forgot-password code bo'lmasa,
        #    signup verificationni tekshiramiz
        if not request.user.is_authenticated:
            raise ValidationError({
                "message": "Your verification code has expired or incorrect."
            })

        verify = self.check_verify(
            request.user,
            code,
            ConfirmationPurpose.SIGNUP
        )

        user = request.user

        if user.auth_status == AuthStatus.NEW:
            user.auth_status = AuthStatus.CODE_VERIFIED
            user.save()

        return Response({
            "success": True,
            "auth_status": user.auth_status,
            "access": user.token()["access"],
            "refresh": user.token()["refresh"]
        })

    @staticmethod
    def check_verify(user, code, purpose):
        verify = user.verify_codes.filter(
            expiration_time__gte=timezone.now(),
            code=code,
            is_confirmed=False,
            purpose=purpose
        ).first()

        if not verify:
            raise ValidationError({
                "message": "Your verification code has expired or incorrect."
            })

        verify.is_confirmed = True
        verify.save(update_fields=["is_confirmed"])

        return verify

class GetNewVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user

        # Agar eski aktiv tasdiqlash kodi bo'lsa,
        # yangi kod yubormaymiz
        self.check_verification(user)

        if user.auth_type == AuthType.VIA_EMAIL:
            code = user.create_verify_code(
                AuthType.VIA_EMAIL,
                ConfirmationPurpose.SIGNUP
            )
            send_email(user.email, code, ConfirmationPurpose.SIGNUP)

        elif user.auth_type == AuthType.VIA_PHONE:
            code = user.create_verify_code(
                AuthType.VIA_PHONE,
                ConfirmationPurpose.SIGNUP
            )
            send_email(user.phone_number, code, ConfirmationPurpose.SIGNUP)

        else:
            raise ValidationError({
                "message": "Email or phone number is incorrect."
            })

        return Response({
            "success": True,
            "message": "Your verification code has been resent."
        })

    @staticmethod
    def check_verification(user):
        verifies = user.verify_codes.filter(
            expiration_time__gte=timezone.now(),
            is_confirmed=False
        )

        if verifies.exists():
            raise ValidationError({
                "message": "Your verification code is available."
            })

class ForgotPasswordResendView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        email_or_phone = request.query_params.get("email_or_phone")

        if not email_or_phone:
            raise ValidationError({
                "message": "Email or phone number is required."
            })

        user = User.objects.filter(
            Q(email=email_or_phone) |
            Q(phone_number=email_or_phone)
        ).first()

        if not user:
            raise ValidationError({
                "message": "User not found."
            })

        self.check_verification(user)

        if user.auth_type == AuthType.VIA_EMAIL:
            code = user.create_verify_code(
                AuthType.VIA_EMAIL,
                ConfirmationPurpose.FORGOT_PASSWORD
            )
            send_email(
                user.email,
                code,
                ConfirmationPurpose.FORGOT_PASSWORD
            )

        elif user.auth_type == AuthType.VIA_PHONE:
            code = user.create_verify_code(
                AuthType.VIA_PHONE,
                ConfirmationPurpose.FORGOT_PASSWORD
            )
            send_email(
                user.phone_number,
                code,
                ConfirmationPurpose.FORGOT_PASSWORD
            )

        else:
            raise ValidationError({
                "message": "Email or phone number is incorrect."
            })

        return Response({
            "success": True,
            "message": "Your verification code has been resent."
        })

    @staticmethod
    def check_verification(user):
        verifies = user.verify_codes.filter(
            expiration_time__gte=timezone.now(),
            is_confirmed=False,
            purpose=ConfirmationPurpose.FORGOT_PASSWORD
        )

        if verifies.exists():
            raise ValidationError({
                "message": "Your verification code is available."
            })

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
            send_email(email_or_phone, code, ConfirmationPurpose.FORGOT_PASSWORD)
        elif check_email_or_phone(email_or_phone) == 'email':
            code = user.create_verify_code(AuthType.VIA_EMAIL, ConfirmationPurpose.FORGOT_PASSWORD)
            send_email(email_or_phone, code, ConfirmationPurpose.FORGOT_PASSWORD)

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