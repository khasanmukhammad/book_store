from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from books.models import Book
from books.seriaizers import BookListSerializer, BookDetailSerializer, BookAddSerializer
from shared.custom_pagination import CustomPagination


#permission only admin
class BookAddView(generics.CreateAPIView):
    serializer_class = BookAddSerializer
    permission_classes = [IsAdminUser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            data={
                'success': True,
                'message': 'Book created successfully',
                'code': status.HTTP_201_CREATED,
            },
            status=status.HTTP_201_CREATED
        )

class BookDeleteUpdateView(generics.DestroyAPIView):
    serializer_class = BookListSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return Book.objects.all()

    def patch(self, request, *args, **kwargs):
        book = self.get_object()
        serializer = self.get_serializer(book, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            data={
                'success': True,
                'message': 'Book updated successfully',
            }
        )

    def delete(self, request, *args, **kwargs):
        book = self.get_object()
        book.delete()
        return Response(
            data={
                'success': True,
                'message': 'Book deleted successfully',
            }
        )


class BookListView(generics.ListAPIView):
    serializer_class = BookListSerializer
    permission_classes = [AllowAny]
    pagination_class = CustomPagination

    def get_queryset(self):
        return Book.objects.all()

class BookDetailView(generics.RetrieveAPIView):
    serializer_class = BookDetailSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Book.objects.all()
