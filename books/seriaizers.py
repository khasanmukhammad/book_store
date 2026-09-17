from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from books.constants import BookStatus
from books.models import book
from books.models.book import Book
from books.models.book_request import BookRequest

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
    id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Book
        fields = ('id',
                  'title', 'description',
                  'category', 'rental_price',
                  'purchase_price', 'status')

class BookCategorySerializers(serializers.ModelSerializer):

    class Meta:
        model = Book
        fields = 'category'


class RequestToBookSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookRequest
        fields = ['id', 'book']
        read_only_fields = ('id', 'book',)

    def validate(self, attrs):
        book = self.context['book']
        if book.status == BookStatus.BOOKED:
            raise serializers.ValidationError(
                "Uzur, bu kitob band qilingan! 3 kun ichida qayta habar oling."
            )
        return attrs

    def create(self, validated_data):
        book = self.context['book']
        validated_data['book'] = book
        validated_data['user'] = self.context['request'].user
        book.status = BookStatus.BOOKED
        book.save()
        return super().create(validated_data)