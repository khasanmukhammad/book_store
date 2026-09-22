from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from books.models.book import Book
from books.seriaizers import BookListSerializer, BookDetailSerializer, BookAddSerializer, BookCategorySerializers, \
    RequestToBookSerializer
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

#permission everyone
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

class BookCategoryListView(generics.ListAPIView):
    serializer_class = BookCategorySerializers
    permission_classes = [AllowAny]
    pagination_class = CustomPagination

    def post(self, request, *args, **kwargs):
        category = request.data.get('category')
        book = Book.objects.filter(category=category)
        serializer = BookListSerializer(book, many=True, context={'request': request})
        return Response(
            data={
                'success': True,
                "data": serializer.data,
            }
        )

class RequestToBookView(generics.CreateAPIView):
    serializer_class = RequestToBookSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['book'] = generics.get_object_or_404(Book, pk=self.kwargs['pk'])
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book_request = serializer.save()

        return Response({
            "success": True,
            "message": "Kitob siz uchun band qilindi. Iltimos, 1 kun ichida olib keting.",
            "id": book_request.id,
            "book": book_request.book.title
        }, status=status.HTTP_201_CREATED)