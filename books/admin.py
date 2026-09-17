from django.contrib import admin

from books.models.book import Book

@admin.register(Book)

class BookAdmin(admin.ModelAdmin):
    list_display = ('title', 'status')
    list_filter = ('status',)
    search_fields = ('title',)
    ordering = ('status',)