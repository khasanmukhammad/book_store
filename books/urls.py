from django.urls import path
from .views import BookListView, BookDetailView,  BookAddView, BookDeleteUpdateView

urlpatterns = [
    path('', BookListView.as_view()),
    path('<uuid:pk>/detail/', BookDetailView.as_view()),

    #permission only admin
    path('add/', BookAddView.as_view()),
    path('<uuid:pk>/', BookDeleteUpdateView.as_view()),
]