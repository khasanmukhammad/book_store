from django.db import models

class AuthStatus(models.TextChoices):
    NEW = 'new'
    CODE_VERIFIED = 'code_verified'
    DONE = 'done'

class AuthType(models.TextChoices):
    VIA_EMAIL = 'via_email'
    VIA_PHONE = 'via_phone'

class ConfirmationPurpose(models.IntegerChoices):
    SIGNUP = 1
    FORGOT_PASSWORD = 2

PHONE_EXPIRE = 2
EMAIL_EXPIRE = 2