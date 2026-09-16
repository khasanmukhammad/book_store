from unicodedata import category

from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from books.constants import BookStatus
from books.models.book import Book

#permission only admin
class BookAddSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=True)
    description = serializers.CharField(required=True)
    category = serializers.CharField(required=True)
    purchase_price = serializers.CharField(required=True)
    rental_price = serializers.CharField(required=True)

    class Meta:
        model = Book
        fields = ('id',
                  'title', 'description',
                  'category',
                  'purchase_price', 'rental_price')

#permission everyone
class BookListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Book
        fields = ('id', 'title', 'status')

class BookDetailSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Book
        fields = ('id',
                  'title', 'description',
                  'category', 'rental_price',
                  'purchase_price', 'status')

class BookCategorySerializers(serializers.ModelSerializer):

    class Meta:
        model = Book
        fields = ('category')

