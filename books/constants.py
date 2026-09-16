from django.db import models

class BookStatus(models.TextChoices):
    AVAILABLE = 'available'
    BOOKED = 'booked'

class BookCategory(models.TextChoices):
    RELIGIOUS = 'religious'
    STORY = 'story'
    FANTASY = 'fantasy'
    SCIENCE = 'science'
    HISTORY = 'history'
    OTHER = 'other'
