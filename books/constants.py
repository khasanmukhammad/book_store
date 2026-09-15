from django.db import models

class BookStatus(models.TextChoices):
    AVAILABLE = 'available'
    BOOKED = 'booked'
