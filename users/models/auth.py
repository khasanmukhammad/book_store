from datetime import datetime, timedelta
from django.db import models

from shared.models import BaseModel
from users.constants import AuthType, EMAIL_EXPIRE, PHONE_EXPIRE, ConfirmationPurpose


class UserConfirmation(BaseModel):
    code = models.CharField(max_length=4)
    verify_type = models.CharField(max_length=31, choices=AuthType.choices)
    user = models.ForeignKey('users.User', models.CASCADE, related_name='verify_codes')
    expiration_time = models.DateTimeField(null=True)
    is_confirmed = models.BooleanField(default=False)
    purpose = models.IntegerField(choices=ConfirmationPurpose.choices)

    def __str__(self):
        return str(self.user.__str__())

    def save(self, *args, **kwargs):
        if self.verify_type == AuthType.VIA_EMAIL:
            self.expiration_time = datetime.now() + timedelta(minutes=EMAIL_EXPIRE)
        else:
            self.expiration_time = datetime.now() + timedelta(minutes=PHONE_EXPIRE)
        super(UserConfirmation, self).save(*args, **kwargs)