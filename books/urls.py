from django.urls import path
from .views import BookListView, BookDetailView, BookAddSerializer, BookAddView

urlpatterns = [
    path('', BookListView.as_view()),
    path('<uuid:pk>/', BookDetailView.as_view()),
    path('add/', BookAddView.as_view()),

]