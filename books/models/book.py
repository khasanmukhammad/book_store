from django.core.validators import FileExtensionValidator
from django.db import models
from books.constants import BookStatus, BookCategory

from shared.models import BaseModel


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Book(BaseModel):
    title = models.CharField(max_length=200)
    description = models.TextField()
    image = models.ImageField(upload_to='images', validators=[FileExtensionValidator(['jpg', 'png', 'jpeg', 'webp'])])
    category = models.TextField(choices=BookCategory.choices)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    rental_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=30, choices=BookStatus.choices, default=BookStatus.AVAILABLE)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title