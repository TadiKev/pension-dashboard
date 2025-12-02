from django.core.management.base import BaseCommand
from faker import Faker
import random
from api.models import Company, Member, PensionAccount, Transaction, AssumptionSet
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = (
        "Seed synthetic data for staging (companies, members, accounts, transactions)"
    )

    def add_arguments(self, parser):
        parser.add_argument("--companies", type=int, default=5)
        parser.add_argument("--members-per-company", type=int, default=50)

    def handle(self, *args, **options):
        fake = Faker()
        User = get_user_model()
        admin_user = User.objects.filter(is_superuser=True).first()
        for _ in range(options["companies"]):
            comp = Company.objects.create(
                name=fake.company(),
                registration_number=fake.bothify(text="??######"),
                address=fake.address(),
                created_by=admin_user,
            )
            AssumptionSet.objects.create(
                company=comp, name="Default", assumptions={"rate_of_return": "0.05"}
            )
            for i in range(options["members-per-company"]):
                m = Member.objects.create(
                    company=comp,
                    first_name=fake.first_name(),
                    last_name=fake.last_name(),
                    date_of_birth=fake.date_of_birth(minimum_age=22, maximum_age=65),
                    national_id=fake.bothify(text="ID########"),
                )
                acc = PensionAccount.objects.create(
                    member=m,
                    account_number=fake.bothify(text="ACCT########"),
                    balance=round(random.uniform(0, 50000), 2),
                )
                for t in range(random.randint(1, 5)):
                    Transaction.objects.create(
                        account=acc,
                        amount=round(random.uniform(10, 5000), 2),
                        transaction_type=random.choice(
                            ["contribution", "payout", "adjustment"]
                        ),
                        source="seed",
                    )
        self.stdout.write(self.style.SUCCESS("Seed complete"))
