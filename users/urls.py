from django.urls import path
from .views import SignUpView, VerifyView, GetNewVerifyView, ChangeUserInformationView, LoginView,\
    LoginRefreshView, LogoutView, ForgetPasswordView, ResetPasswordView

urlpatterns = [
    path('signup/', SignUpView.as_view()),
    path('verify/', VerifyView.as_view()),
    path('new-verify/', GetNewVerifyView.as_view()),
    path('change-user/', ChangeUserInformationView.as_view()),
    path('login/', LoginView.as_view()),
    path('login-refresh/', LoginRefreshView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('forget-password/', ForgetPasswordView.as_view()),
    path('reset-password/', ResetPasswordView.as_view()),
]