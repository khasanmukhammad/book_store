import random
import uuid
from datetime import datetime, timedelta
from locale import normalize

from django.contrib.auth.models import AbstractUser
from django.db import models
from rest_framework_simplejwt.tokens import RefreshToken

from shared.models import BaseModel


VIA_EMAIL, VIA_PHONE = ("via_email", "via_phone")
NEW, CODE_VERIFIED, DONE = ("new", "code_verified", "done")

class User(AbstractUser, BaseModel):
    AUTH_TYPE_CHOICES = (
        (VIA_EMAIL, VIA_EMAIL),
        (VIA_PHONE, VIA_PHONE),
    )
    AUTH_STATUS = (
        (NEW, NEW),
        (CODE_VERIFIED, CODE_VERIFIED),
        (DONE, DONE),
    )

    auth_type = models.CharField(max_length=33, choices=AUTH_TYPE_CHOICES)
    auth_status = models.CharField(max_length=33, choices=AUTH_STATUS, default=NEW)
    email = models.EmailField(unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True, unique=True)


    def __str__(self):
        return self.username

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def create_verify_code(self, verify_type):
        code = "".join([str(random.randint(0, 1000) % 10 ) for _ in range(4)])
        now = datetime.now()
        UserConfirmation.objects.create(
            user_id=self.id,
            verify_type=verify_type,
            code=code,
            expiration_time=now + timedelta(minutes=5),
        )
        return code

    def check_username(self):
        if not self.username:
            temp_username = f'username-{uuid.uuid4().__str__().split("-")[-1]}'
            while User.objects.filter(username=temp_username).exists():
                temp_username = f'{temp_username}{random.randint(1, 100)}'
            self.username = temp_username

    def check_pass(self):
        if not self.password:
            temp_password = f'password-{uuid.uuid4().__str__().split("-")[-1]}'
            self.password = temp_password

    def check_email(self):
        if self.email:
            normalize_email = self.email.lower()
            self.email = normalize_email

    def hashing_password(self):
        if not self.password.startswith("pbkdf2_sha256"):
            self.set_password(self.password)


    def token(self):
        refresh = RefreshToken.for_user(self)
        return{
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }

    def save(self, *args, **kwargs):
        self.clean()
        super(User, self).save(*args, **kwargs)

    def clean(self):
        self.check_email()
        self.check_password()
        self.check_username()
        self.hashing_password()

PHONE_EXPIRE = 2
EMAIL_EXPIRE = 2

class UserConfirmation(BaseModel):
    TYPE_CHOICES = (
        (VIA_EMAIL, VIA_EMAIL),
        (VIA_PHONE, VIA_PHONE),
    )
    code = models.CharField(max_length=4)
    verify_type = models.CharField(max_length=31, choices=TYPE_CHOICES)
    user = models.ForeignKey('users.User', models.CASCADE, related_name='verify_codes')
    expiration_time = models.DateTimeField(null=True)
    is_confirmed = models.BooleanField(default=False)

    def __str__(self):
        return str(self.user.__str__())

    def save(self, *args, **kwargs):
        if self.verify_type == VIA_EMAIL:
            self.expiration_time = datetime.now() + timedelta(minutes=EMAIL_EXPIRE)
        else:
            self.expiration_time = datetime.now() + timedelta(minutes=PHONE_EXPIRE)
        super(UserConfirmation, self).save(*args, **kwargs)