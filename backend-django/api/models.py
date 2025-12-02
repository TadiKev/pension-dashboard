from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator


class CustomUser(AbstractUser):
    is_company_user = models.BooleanField(default=False)
    is_talent_verify = models.BooleanField(default=False)

    def __str__(self):
        return self.username


class Company(models.Model):
    name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=100, blank=True, null=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_companies",
    )

    def __str__(self):
        return self.name


class Member(models.Model):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="members"
    )
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    date_of_birth = models.DateField(null=True, blank=True)
    national_id = models.CharField(max_length=128, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class PensionAccount(models.Model):
    STATUS_CHOICES = (
        ("active", "Active"),
        ("closed", "Closed"),
        ("suspended", "Suspended"),
    )
    member = models.ForeignKey(
        Member, on_delete=models.CASCADE, related_name="accounts"
    )
    account_number = models.CharField(max_length=64, unique=True)
    balance = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.account_number} ({self.member})"


class Transaction(models.Model):
    TRAN_TYPE = (
        ("contribution", "Contribution"),
        ("payout", "Payout"),
        ("adjustment", "Adjustment"),
    )
    account = models.ForeignKey(
        PensionAccount, on_delete=models.CASCADE, related_name="transactions"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TRAN_TYPE)
    date = models.DateTimeField(default=timezone.now)
    source = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transactions_created",
    )

    def __str__(self):
        return f"{self.transaction_type} {self.amount} for {self.account}"


class AssumptionSet(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="assumptions",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    # Django 3.1+ has models.JSONField. In older versions a TextField could be used.
    try:
        _json_field = models.JSONField  # type: ignore[attr-defined]
    except Exception:
        _json_field = models.TextField  # fallback

    assumptions = _json_field(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    def __str__(self):
        return f"{self.name} ({self.company})"
