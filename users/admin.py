from django.contrib import admin
from .models import User, UserConfirmation

class UserModelAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'phone_number')

admin.site.register(User, UserModelAdmin)

class UserConfirmationModelAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'user__phone_number', "expiration_time", "is_confirmed")
admin.site.register(UserConfirmation, UserConfirmationModelAdmin)
