from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser,
    Company,
    Member,
    PensionAccount,
    Transaction,
    AssumptionSet,
)


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = (
        "username",
        "email",
        "is_company_user",
        "is_talent_verify",
        "is_staff",
    )


admin.site.register(Company)
admin.site.register(Member)
admin.site.register(PensionAccount)
admin.site.register(Transaction)
admin.site.register(AssumptionSet)
