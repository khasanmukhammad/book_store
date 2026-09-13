import datetime

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.generics import CreateAPIView, UpdateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from shared.utility import send_email
from .models import User, NEW, CODE_VERIFIED, VIA_EMAIL, VIA_PHONE
from .serilalizers import SignUpSerializer, ChangeUserInformationSerializer, LoginSerializer,\
    LoginRefreshSerializer


class SignUpView(CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = SignUpSerializer
    queryset = User.objects.all()

class VerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = self.request.user
        code = request.data.get('code')

        try:
            code = int(code)
        except ValueError:
            raise ValidationError("Invalid code")

        self.check_verify(user, code)
        return Response(
            data={
                "success": True,
                "auth_status": user.auth_status,
                "access": user.token()["access"],
                "refresh": user.token()["refresh"],
            }
        )

    @staticmethod
    def check_verify(user, code):
        verifies = user.verify_codes.filter(expiration_time__gte=datetime.datetime.now(), code=code, is_confirmed=False)
        print(verifies)
        if not verifies.exists():
            data = {
                "message": "Your verification code has expired or incorrect.",
            }
            raise ValidationError(data)
        else:
            verifies.update(is_confirmed=True)
        if user.auth_status == NEW:
            user.auth_status = CODE_VERIFIED
            user.save()
        return True

class GetNewVerifyView(APIView):
    permission_classes = [IsAuthenticated]


    def get(self, request, *args, **kwargs):
        user = self.request.user
        self.check_verification(user)
        if user.auth_type == (VIA_EMAIL):
            code = user.create_verify_code(VIA_EMAIL)
            send_email(user.email, code)
        elif user.auth_type == (VIA_PHONE):
            code = user.create_verify_code(VIA_PHONE)
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