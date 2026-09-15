from rest_framework import serializers

from books.models import Book

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